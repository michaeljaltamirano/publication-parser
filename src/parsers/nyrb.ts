import jsdom from 'jsdom';
import ENV from '../env.js';
import {
  fetchContent,
  getOptions,
  throwCookieError,
  handleError,
  isNotNullish,
  writeHtmlFile,
  getEpub,
} from '../utils.js';

const { JSDOM } = jsdom;

const publicationName = 'The New York Review of Books';
// const cookie = "wordpress_logged_in_XXX=XXX";
const { nyrbCookie: cookie } = ENV;

const processContent = (articleDom: jsdom.JSDOM, dom: jsdom.JSDOM) => {
  const header = articleDom.window.document.querySelector<HTMLHeadingElement>(
    'header[class*="article-header"]',
  );

  if (!header) {
    throw new Error('header parse error');
  }

  const title = header.querySelector('h1');
  const author = header.querySelector<HTMLElement>('div.author');
  const dek = header.querySelector<HTMLElement>('div.dek:not(.author)');

  const titleAndAuthorMarkup = `<h2 class="chapter">${
    title?.innerHTML ?? ''
  }</h2><h3>${author?.textContent ?? ''}</h3><h3>${dek?.outerHTML ?? ''}</h3>`;

  const article =
    articleDom.window.document.querySelector<HTMLElement>('article.article');

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

  if (!isNotNullish(body)) {
    throw new Error('No article body!');
  }

  const bodyMarkup = Array.from(body).reduce((_acc, markup) => {
    const nodes = Array.from(markup.childNodes) as HTMLElement[];

    return nodes.reduce((innerAcc, node) => {
      if (
        !node.outerHTML ||
        (isNotNullish(node.classList) &&
          Array.from(node.classList).includes('inline-ad'))
      )
        return innerAcc;

      return innerAcc + node.outerHTML;
    }, '');
  }, '');

  const authorInfo = article.querySelector('.author-info > p');

  dom.window.document.body.innerHTML = `${
    dom.window.document.body.innerHTML
  }<div class="article-container">${titleAndAuthorMarkup}${
    reviewedItems?.outerHTML ?? ''
  }${bodyMarkup}${authorInfo?.outerHTML ?? ''}</div>`;

  return undefined;
};

async function processHrefs(
  hrefs: string[],
  volumeNumberAndDate: string,
  options: Record<string, unknown>,
) {
  const dom = new JSDOM('<!DOCTYPE html>');
  dom.window.document.body.innerHTML = `<h1 class="book">${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);

    try {
      const result = await fetchContent(href, options);

      if (!isNotNullish(result)) {
        throw new Error('fetchContent error!');
      }

      const articleDom = new JSDOM(result);

      const paywall = articleDom.window.document.querySelector('.paywall');

      if (paywall) throwCookieError();

      processContent(articleDom, dom);
    } catch (e: unknown) {
      handleError(e);
    }
  }

  writeHtmlFile({
    html: dom.window.document.body.innerHTML,
    publicationName,
    shorthand: 'nyrb',
    volumeNumberAndDate,
  });

  const epub = await getEpub({
    publicationName,
    shorthand: 'nyrb',
    volumeNumberAndDate,
  });

  console.log('Fetching complete!');

  return {
    html: dom.window.document.body.outerHTML,
    epub,
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
  const result = await fetchContent(issueUrl, options);

  if (!isNotNullish(result)) {
    throw new Error('fetchContent error!');
  }

  const dom = new JSDOM(result);
  const tableOfContentsLinks =
    dom.window.document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="nybooks.com/articles"]',
    );
  const hrefs = Array.from(tableOfContentsLinks).map((link) => link.href);

  const date = dom.window.document.querySelector<HTMLElement>(
    'header.issue_header > p.h2',
  )?.textContent;

  if (!isNotNullish(date)) {
    throw new Error('Issue date parsing error');
  }

  return processHrefs(hrefs, date, options);
}
