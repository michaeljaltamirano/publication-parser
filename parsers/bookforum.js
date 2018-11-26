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

const baseUrl = 'https://bookforum.com/';
let volumeNumberAndDate;
const publicationName = 'Bookforum';
// const cookie = "bfsid=XXX; login=XXX";
const { bookforumCookie: cookie } = ENV;

async function processHrefs(hrefs, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${baseUrl}${href}`);
    await fetchContentArrayBuffer(`${baseUrl}${href}`, options)
      .then(result => {
        const articleDom = new JSDOM(result);

        const paywall = articleDom.window.document.querySelector('.Paywall');

        if (paywall) throwCookieError();

        const article = articleDom.window.document.querySelector('.Core');

        // Clear cruft: issue volume, list price, external purchase links,
        // comments sections, and social media tools
        const listPrice = articleDom.window.document.querySelector('h4');
        if (listPrice) listPrice.innerHTML = '';
        const purchaseLinks = articleDom.window.document.querySelector('h5');
        if (purchaseLinks) purchaseLinks.innerHTML = '';
        const issueAndVolume = articleDom.window.document.querySelector('h6');
        if (issueAndVolume) issueAndVolume.innerHTML = '';

        const tools = article.querySelectorAll('.Tools');
        if (tools) tools.forEach(tool => (tool.innerHTML = ''));
        const talkback = article.querySelector('.TalkBack');
        if (talkback) talkback.innerHTML = '';

        const images = article.querySelectorAll('img');

        images.forEach(image => (image.src = `${baseUrl}${image.src}`));

        return (dom.window.document.body.innerHTML = `${
          dom.window.document.body.innerHTML
        }<div class="article-container">${article.innerHTML}</div>`);
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
    // Bookforum charset for accented and other characters
    'Content-Type': 'text/html; charset=iso-8859-15',
  };

  const options = getOptions({ headers, issueUrl: `${baseUrl}${issueUrl}` });

  // Get list of articles from the Table of Contents
  return fetchContent(issueUrl, options).then(result => {
    const dom = new JSDOM(result);
    const toc = dom.window.document.getElementById('ToC');
    const a = toc.querySelectorAll('a');
    const setLinks = new Set();

    // Only grab article links, not author or section links
    a.forEach(link => {
      if (link.href.indexOf('/inprint/') > -1) {
        setLinks.add(link.href);
      }
    });

    // Clear dupes (lazy);
    const hrefs = Array.from(setLinks);

    // Cleans bookforum format--Sep/Oct/Nov--since those aren't directories
    volumeNumberAndDate = dom.window.document
      .querySelector('.Topper')
      .textContent.replace(/\//g, '-');

    return processHrefs(hrefs, options);
  });
}

module.exports = bookforumParser;
