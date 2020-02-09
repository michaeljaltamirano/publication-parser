const fs = require('fs');
const jsdom = require('jsdom');
const ENV = require('../env');
const UTILS = require('../utils');
const { JSDOM } = jsdom;
const { fetchContent, getOptions, throwCookieError, handleError } = UTILS;
const baseUrl = 'https://www.lrb.co.uk';
const publicationName = 'The London Review of Books';
// const cookie = "lrb-session=XXX; lrb-remember-me=XXX;";
const { lrbCookie: cookie } = ENV;

async function processHrefs(hrefs, volumeNumberAndDate, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);

  dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const item of hrefs) {
    // Get articles
    console.log(`Fetching: ${baseUrl}${item}`);
    await fetchContent(`${baseUrl}${item}`, options)
      .then(result => {
        const articleDom = new JSDOM(`<!DOCTYPE html>`);
        articleDom.window.document.body.innerHTML = result;

        const isPaywalled = !!articleDom.window.document.getElementById(
          'lrb-pw-block'
        );

        if (isPaywalled) throwCookieError();

        // If present, parse letters-specific page
        const lettersHeader = articleDom.window.document.getElementById(
          'letters-heading-holder'
        );

        // Otherwise, parse regular article
        const articleHeader = articleDom.window.document.getElementById(
          'article-heading-holder'
        );

        if (lettersHeader) {
          const letters = articleDom.window.document.getElementById(
            'lrb-lettersCopy'
          );

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<h1>${lettersHeader.firstChild.innerHTML}</h1><div>${letters.innerHTML}</div><br>End Letters<br>`);
        } else if (articleHeader) {
          const h1 = articleHeader.firstChild.textContent;
          const h2 = articleHeader.lastChild.textContent;
          const reviewedItemsHolder = articleDom.window.document.querySelector(
            '.reviewed-items-holder'
          );
          let reviewedItemsContent = {
            innerHTML: '',
          };

          if (reviewedItemsHolder) {
            const reviewedItems = articleDom.window.document.querySelector(
              '.reviewed-items'
            );

            if (reviewedItems) {
              // Remove show more link
              const showMores = reviewedItemsHolder.querySelectorAll(
                '.lrb-readmorelink'
              );

              if (showMores)
                showMores.forEach(showMoreLink => showMoreLink.remove());

              // Clean info
              reviewedItems.childNodes.forEach(review => {
                const by = review.querySelector('.by');
                const meta = by.querySelector('.item-meta');

                // If there's book info, remove it
                if (meta.querySelector('.nowrap')) {
                  by.removeChild(meta);
                }
              });

              reviewedItemsContent = reviewedItems;
            }
          }

          const body = articleDom.window.document.querySelector(
            '.article-copy'
          );

          // Remove subscriber mask
          const articleMask = body.querySelector('.article-mask');
          if (articleMask) body.removeChild(articleMask);

          // If there's images, correctly load them
          body.querySelectorAll('img').forEach(img => {
            const srcset = img.getAttribute('data-srcset');
            img.src = `http://www.lrb.co.uk${srcset}`;
          });

          const innerHTMLWithArticle = `${dom.window.document.body.innerHTML}<div><h1>${h1}</h1><h2>${h2}</h2></div><div>${reviewedItemsContent.innerHTML}</div><div>${body.innerHTML}</div><br>End Article<br>`;

          dom.window.document.body.innerHTML = innerHTMLWithArticle;
        }
      })
      .catch(err => handleError(err));
  }

  fs.writeFile(
    `output/lrb/${publicationName} - ${volumeNumberAndDate}.html`,
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

async function lrbParser(issueUrl) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl });

  // Get list of articles
  return fetchContent(issueUrl, options).then(result => {
    const firstDateSplit = result.split(`<div class="toc-cover-titles">`);
    const secondDateSplit = firstDateSplit[1].split(
      `</div><div class="toc-cover-artist">`
    );
    const dateDom = new JSDOM(`<!DOCTYPE html>`);

    dateDom.window.document.body.innerHTML = `<div id="date-and-volume">${secondDateSplit[0]}</div>`;

    const div = dateDom.window.document.getElementById('date-and-volume');

    const volumeNumberAndDate = div.firstChild.textContent;

    const firstSplit = result.split(`<div class="toc-content-holder">`);
    const secondSplit = firstSplit[1].split(
      `</div><div class="toc-cover-artist toc-cover-artist--footer" aria-hidden="true">`
    );

    const dom = new JSDOM(`<!DOCTYPE html>`);
    dom.window.document.body.innerHTML = secondSplit[0];

    const linksDiv = dom.window.document.body.querySelector('.toc-grid-items');
    const hrefs = Array.from(linksDiv.childNodes).map(link => link.href);

    return processHrefs(hrefs, volumeNumberAndDate, options);
  });
}

module.exports = lrbParser;
