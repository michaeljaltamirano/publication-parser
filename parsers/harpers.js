const fs = require('fs');
const jsdom = require('jsdom');
const ENV = require('../env');
const UTILS = require('../utils');
const { JSDOM } = jsdom;
const { fetchContent, getOptions, throwCookieError, handleError } = UTILS;

let volumeNumberAndDate;
const publicationName = "Harper's Magazine";
// const cookie = "wordpress_logged_in_XXX=XXX";
const { harpersCookie: cookie } = ENV;

async function processHrefs(hrefs, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerText = `<h1>${publicationName} ${volumeNumberAndDate}</h1>`;
  let pdfs = [];

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContent(href, options)
      .then(result => {
        const articleDom = new JSDOM(result);

        const paywall = articleDom.window.document.getElementById(
          'leaky_paywall_message'
        );

        if (paywall) throwCookieError();

        const issueArticle = articleDom.window.document.getElementById(
          'issueArticle'
        );

        const pdfOnly = issueArticle.querySelector('.highLightBox');

        if (pdfOnly) {
          const start = pdfOnly.outerHTML.indexOf(
            'https://archive.harpers.org/'
          );
          const end = pdfOnly.outerHTML.indexOf('>PDF<') - 1;
          const title = issueArticle.querySelector('h1').textContent;
          const path = pdfOnly.outerHTML.substring(start, end);

          // Attachment formatting for Nodemailer
          pdfs.push({ path, title, contentType: 'application/pdf' });
        } else {
          const post = issueArticle.querySelector('.post');

          // Remove CTA text
          const downloadPdf = post.querySelector('.tabDownloadPDF');
          if (downloadPdf) downloadPdf.remove(downloadPdf);
          const readOnline = post.querySelector('.tabMicrofiche');
          if (readOnline) readOnline.remove(readOnline);
          // Remove "From the [date] issue" text that accompanies every
          // article, but keep the section heading
          const category = post.querySelector('.category');
          if (category) category.removeChild(category.lastChild);

          const articlePost = issueArticle.querySelector('.articlePost');
          const bio = issueArticle.querySelector('.COA_roles_fix');

          return (dom.window.document.body.innerHTML = `${
            dom.window.document.body.innerHTML
          }<div class="article-container">${post.innerHTML}${
            articlePost.innerHTML
          }${bio.innerHTML}</div>`);
        }
      })
      .catch(error => handleError(error));
  }

  fs.writeFile(
    `output/harpers/${publicationName} - ${volumeNumberAndDate}.html`,
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
    pdfs,
  };
}

async function harpersParser(issueUrl) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl });

  // Get list of articles from the Table of Contents
  return fetchContent(issueUrl, options).then(result => {
    const dom = new JSDOM(result);
    const issueContent = dom.window.document.getElementById('issueContent');
    const issues = issueContent.querySelectorAll('.Issue');

    let hrefs = [];

    issues.forEach(article => {
      const h2s = article.querySelectorAll('h2');

      h2s.forEach(h2 => hrefs.push(h2.querySelector('a').href));
    });

    volumeNumberAndDate = dom.window.document.querySelector('h1').innerHTML;

    return processHrefs(hrefs, options);
  });
}

module.exports = harpersParser;
