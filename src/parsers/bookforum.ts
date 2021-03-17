import fs from 'fs';
import jsdom from 'jsdom';

import ENV from '../env';
import {
  fetchContent,
  fetchContentArrayBuffer,
  getOptions,
  throwCookieError,
  handleError,
  isNotNullish,
} from '../utils';

const { JSDOM } = jsdom;

const publicationName = 'Bookforum';
// const cookie = "bfsid=XXX; login=XXX";
const { bookforumCookie: cookie } = ENV;

async function processHrefs(
  hrefs: string[],
  volumeNumberAndDate: string,
  options: ReturnType<typeof getOptions>,
) {
  const dom = new JSDOM('<!DOCTYPE html>');
  dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContentArrayBuffer(`${href}`, options)
      .then((result) => {
        if (isNotNullish(result)) {
          throw new Error('fetchContentArrayBuffer error!');
        }

        const articleDom = new JSDOM(result);

        const paywall = articleDom.window.document.querySelector('.paywall');
        const paywallStyle = paywall?.getAttribute('style');

        const isPaywalled = paywallStyle?.includes('display: none');

        if (!isNotNullish(isPaywalled)) throwCookieError();

        const article = articleDom.window.document.querySelector(
          '.blog-article',
        );

        if (article) {
          // Clear cruft: purchase links, social share links, anchor link formatting
          article
            .querySelectorAll('.book-info__purchase-links')
            .forEach((el) => {
              // eslint-disable-next-line no-param-reassign
              el.innerHTML = '';
            });
          article.querySelectorAll('af-share-toggle').forEach((el) => {
            // eslint-disable-next-line no-param-reassign
            el.innerHTML = '';
          });

          const shareLinks = article.querySelectorAll('a.share');

          shareLinks.forEach((el) => {
            const parentNode = el.parentNode as HTMLElement | null;

            if (isNotNullish(parentNode)) {
              parentNode.innerHTML = el.innerHTML;
            }
          });

          // Src in form //www, prepend for proper rendering outside of browser
          article.querySelectorAll('img').forEach((image) => {
            // eslint-disable-next-line no-param-reassign
            image.src = `https:${image.src}`;
          });

          const articleString = `${dom.window.document.body.innerHTML}<div class="article-container">${article.innerHTML}</div>`;

          dom.window.document.body.innerHTML = articleString;
        } else {
          throw new Error('Unresolved path!');
        }
      })
      .catch((err) => handleError(err));
  }

  fs.writeFile(
    `output/bookforum/${publicationName} - ${volumeNumberAndDate}.html`,
    dom.window.document.body.innerHTML,
    (err) => {
      if (err) throw err;
    },
  );

  console.log('Fetching complete!');

  return {
    html: dom.window.document.body.innerHTML,
    volumeNumberAndDate,
    publicationName,
  };
}

export default async function bookforumParser(issueUrl: string) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl: `${issueUrl}` });

  // Get list of articles from the Table of Contents
  return fetchContent(issueUrl, options).then(async (result) => {
    if (!isNotNullish(result)) {
      throw new Error('fetchContent error!');
    }

    const dom = new JSDOM(result);

    const articleLinks = dom.window.document.querySelectorAll<HTMLAnchorElement>(
      '.toc-article__link',
    );

    // Clear duplicate links for feature headings
    const hrefs = Array.from(
      new Set(
        Array.from(articleLinks)
          .map((article) => {
            // Safe check to confirm article is HTMLAnchorElement
            if (article.href) {
              return article.href;
            }

            return null;
          })
          .filter(isNotNullish),
      ),
    );

    const tocTitle = dom.window.document.querySelector('.toc-issue__title');
    const titleContent = tocTitle?.textContent ?? '';

    // Cleans bookforum format--"Sep/Oct/Nov"--since those aren't directories
    const volumeNumberAndDate = titleContent.replace(/\//g, '-');

    return processHrefs(hrefs, volumeNumberAndDate, options);
  });
}
