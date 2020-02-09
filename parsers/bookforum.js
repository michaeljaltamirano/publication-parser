const fs = require('fs');
const jsdom = require('jsdom');
const ENV = require('../env');
const UTILS = require('../utils');
const { JSDOM } = jsdom;
const {
  fetchContent,
  fetchContentArrayBuffer,
  getOptions,
  throwCookieError,
  handleError,
} = UTILS;

const publicationName = 'Bookforum';
// const cookie = "bfsid=XXX; login=XXX";
const { bookforumCookie: cookie } = ENV;

async function processHrefs(hrefs, volumeNumberAndDate, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContentArrayBuffer(`${href}`, options)
      .then(result => {
        const articleDom = new JSDOM(result);

        const paywall = articleDom.window.document.querySelector('.paywall');

        const isPaywalled =
          paywall && paywall.getAttribute('style').includes('display: none');

        if (isPaywalled) throwCookieError();

        const article = articleDom.window.document.querySelector(
          '.blog-article'
        );

        // Clear cruft: purchase links, social share links, anchor link formatting
        article
          .querySelectorAll('.book-info__purchase-links')
          .forEach(el => (el.innerHTML = ''));
        article
          .querySelectorAll('af-share-toggle')
          .forEach(el => (el.innerHTML = ''));
        article
          .querySelectorAll('a')
          .forEach(el => (el.parentNode.innerHTML = el.innerHTML));

        // Src in form //www, prepend for proper rendering outside of browser
        article
          .querySelectorAll('img')
          .forEach(image => (image.src = `https:${image.src}`));

        const articleString = `${dom.window.document.body.innerHTML}<div class="article-container">${article.innerHTML}</div>`;

        dom.window.document.body.innerHTML = articleString;
      })
      .catch(err => handleError(err));
  }

  fs.writeFile(
    `output/bookforum/${publicationName} - ${volumeNumberAndDate}.html`,
    dom.window.document.body.innerHTML,
    err => {
      if (err) throw err;
    }
  );

  console.log('Fetching complete!');

  return {
    html: dom.window.document.body.innerHTML,
    volumeNumberAndDate,
    publicationName,
  };
}

async function bookforumParser(issueUrl) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl: `${issueUrl}` });

  // Get list of articles from the Table of Contents
  return fetchContent(issueUrl, options).then(result => {
    const dom = new JSDOM(result);

    const articleLinks = dom.window.document.querySelectorAll(
      '.toc-article__link'
    );

    // Clear duplicate links for feature headings
    const hrefs = Array.from(
      new Set(Array.from(articleLinks).map(article => article.href))
    );

    // Cleans bookforum format--"Sep/Oct/Nov"--since those aren't directories
    const volumeNumberAndDate = dom.window.document
      .querySelector('.toc-issue__title')
      .textContent.replace(/\//g, '-');

    return processHrefs(hrefs, volumeNumberAndDate, options);
  });
}

module.exports = bookforumParser;
