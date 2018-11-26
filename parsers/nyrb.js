const fs = require('fs');
const jsdom = require('jsdom');
const ENV = require('../env');
const UTILS = require('../utils');
const { JSDOM } = jsdom;
const { fetchContent, getOptions, throwCookieError, handleError } = UTILS;

let volumeNumberAndDate;
const publicationName = 'The New York Review of Books';
// const cookie = "wordpress_logged_in_XXX=XXX";
const { nyrbCookie: cookie } = ENV;

async function processHrefs(hrefs, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerText = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContent(href, options)
      .then(result => {
        const articleDom = new JSDOM(result);

        const paywall = articleDom.window.document.querySelector('.paywall');

        if (paywall) throwCookieError();

        const article = articleDom.window.document.querySelector(
          'article.article'
        );

        const header = article.querySelector('header');
        const body = article.querySelector('section.article_body');

        return (dom.window.document.body.innerHTML = `${
          dom.window.document.body.innerHTML
        }<div class="article-container">${header.innerHTML}${
          body.innerHTML
        }</div>`);
      })
      .catch(error => handleError(error));
  }

  fs.writeFile(
    `output/nyrb/${publicationName} - ${volumeNumberAndDate}.html`,
    dom.window.document.body.innerHTML,
    error => {
      if (error) throw error;
    }
  );

  console.log('Fetching complete!');

  return {
    html: dom.window.document.body.innerHTML,
    volumeNumberAndDate,
    publicationName,
  };
}

async function nyrbParser(issueUrl) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl });

  // Get list of articles from the Table of Contents
  return fetchContent(issueUrl, options).then(result => {
    const dom = new JSDOM(result);
    const tableOfContentsH2s = dom.window.document.querySelectorAll('h2');
    let hrefs = [];

    tableOfContentsH2s.forEach(h2 => {
      const a = h2.querySelector('a');
      if (a) {
        hrefs.push(a.href);
      }
    });

    volumeNumberAndDate = dom.window.document.querySelector('time').innerHTML;

    return processHrefs(hrefs, options);
  });
}

module.exports = nyrbParser;
