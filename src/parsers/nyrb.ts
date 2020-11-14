import fs from 'fs';
import jsdom from 'jsdom';
import ENV from '../env';
const { JSDOM } = jsdom;
import {
  fetchContent,
  getOptions,
  throwCookieError,
  handleError,
} from '../utils';

const publicationName = 'The New York Review of Books';
// const cookie = "wordpress_logged_in_XXX=XXX";
const { nyrbCookie: cookie } = ENV;

async function processHrefs(
  hrefs: string[],
  volumeNumberAndDate: string,
  options: Record<string, unknown>,
) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContent(href, options)
      .then((result) => {
        if (!result) {
          throw new Error('fetchContent error!');
        }

        const articleDom = new JSDOM(result);

        const paywall = articleDom.window.document.querySelector('.paywall');

        if (paywall) throwCookieError();

        const header = articleDom.window.document.querySelector<
          HTMLHeadingElement
        >('header[class*="article-header"]');

        if (!header) {
          throw new Error('header parse error');
        }

        const title = header.querySelector('h1');
        const author = header.querySelector<HTMLElement>('div.author');
        const dek = header.querySelector<HTMLElement>('div.dek:not(.author)');

        const titleAndAuthorMarkup = `<heading>${
          title?.outerHTML || ''
        }</heading><h2>${author?.textContent || ''}</h2><h3>${
          dek?.outerHTML || ''
        }</h3>`;

        const article = articleDom.window.document.querySelector<HTMLElement>(
          'article.article',
        );

        if (!article) {
          throw new Error('article parse error');
        }

        const reviewedItems = article.querySelector('.review-items');

        // The only content we're interested in is in the first div.row in <article>
        const firstRow = article.querySelector('.row');

        if (!firstRow) {
          throw new Error('row parse error');
        }

        /**
         * Includes:
         *
         * 1. Letters to the editors "In response to:" preface
         * 2. Any preface ("addendum") to the article body (e.g. "This article is part of...")
         * 3. Article body
         */
        const body = firstRow.querySelectorAll<HTMLElement>('div.article-col');

        if (!body) {
          throw new Error('No article body!');
        }

        const bodyMarkup = Array.from(body).reduce((acc, markup) => {
          const nodes = Array.from(markup.childNodes) as HTMLElement[];

          acc = nodes.reduce((acc, node) => {
            if (
              !node.outerHTML ||
              (node.classList &&
                Array.from(node.classList).includes('inline-ad'))
            )
              return acc;

            return (acc += node.outerHTML);
          }, '');

          return acc;
        }, '');

        const authorInfo = article.querySelector('.author-info > p');

        return (dom.window.document.body.innerHTML = `${
          dom.window.document.body.innerHTML
        }<div class="article-container">${titleAndAuthorMarkup}${
          reviewedItems?.outerHTML || ''
        }${bodyMarkup}${authorInfo?.outerHTML || ''}</div>`);
      })
      .catch((error) => handleError(error));
  }

  fs.writeFile(
    `output/nyrb/${publicationName} - ${volumeNumberAndDate}.html`,
    dom.window.document.body.innerHTML,
    (error) => {
      if (error) throw error;
    },
  );

  console.log('Fetching complete!');

  return {
    html: dom.window.document.body.innerHTML,
    volumeNumberAndDate,
    publicationName,
  };
}

export default async function nyrbParser(issueUrl: string) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl });

  // Get list of articles from the Table of Contents
  return fetchContent(issueUrl, options).then((result) => {
    if (!result) {
      throw new Error('fetchContent error!');
    }

    const dom = new JSDOM(result);
    const tableOfContentsLinks = dom.window.document.querySelectorAll<
      HTMLAnchorElement
    >('a[href*="nybooks.com/articles"]');
    const hrefs = Array.from(tableOfContentsLinks).map((link) => link.href);

    const date = dom.window.document.querySelector<HTMLElement>(
      'header.issue_header > p.h2',
    )?.textContent;

    if (!date) {
      throw new Error('Issue date parsing error');
    }

    return processHrefs(hrefs, date, options);
  });
}
