import fs from 'fs';
import jsdom from 'jsdom';
import ENV from '../env';
import {
  fetchContent,
  getOptions,
  throwCookieError,
  handleError,
  isNotNullish,
} from '../utils';

const { JSDOM } = jsdom;

const baseUrl = 'https://www.lrb.co.uk';
const publicationName = 'The London Review of Books';
// const cookie = "lrb-session=XXX; lrb-remember-me=XXX;";
const { lrbCookie: cookie } = ENV;

const MIN_LENGTH = 0;

async function processHrefs(
  hrefs: string[],
  volumeNumberAndDate: string,
  options: ReturnType<typeof getOptions>,
) {
  const dom = new JSDOM('<!DOCTYPE html>');

  dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const item of hrefs) {
    // Get articles
    console.log(`Fetching: ${baseUrl}${item}`);
    await fetchContent(`${baseUrl}${item}`, options)
      .then((result) => {
        if (!isNotNullish(result)) {
          throw new Error('fetchContent error!');
        }

        const articleDom = new JSDOM('<!DOCTYPE html>');
        articleDom.window.document.body.innerHTML = result;

        const isPaywalled = !!articleDom.window.document.getElementById(
          'lrb-pw-block',
        );

        if (isPaywalled) throwCookieError();

        // If present, parse letters-specific page
        const lettersHeader = articleDom.window.document.getElementById(
          'letters-heading-holder',
        );

        // Otherwise, parse regular article
        const articleHeader = articleDom.window.document.getElementById(
          'article-heading-holder',
        );

        if (lettersHeader) {
          const letters = articleDom.window.document.getElementById(
            'lrb-lettersCopy',
          );

          const lettersHeaderFirstChild = lettersHeader.firstChild as HTMLElement | null;

          dom.window.document.body.innerHTML = `${
            dom.window.document.body.innerHTML
          }<h1>${lettersHeaderFirstChild?.innerHTML ?? ''}</h1><div>${
            letters?.innerHTML ?? ''
          }</div><br>End Letters<br>`;

          return undefined;
        }

        if (articleHeader) {
          const h1 = articleHeader.firstChild?.textContent ?? '';
          const h2 = articleHeader.lastChild?.textContent ?? '';
          const reviewedItemsHolder = articleDom.window.document.querySelector(
            '.reviewed-items-holder',
          );
          let reviewedItemsContent = {
            innerHTML: '',
          };

          if (reviewedItemsHolder) {
            const reviewedItems = articleDom.window.document.querySelector(
              '.reviewed-items',
            );

            if (reviewedItems) {
              // Remove show more link
              const showMores = reviewedItemsHolder.querySelectorAll(
                '.lrb-readmorelink',
              );

              if (showMores.length > MIN_LENGTH)
                showMores.forEach((showMoreLink) => {
                  showMoreLink.remove();
                });

              // Clean info
              const reviewedItemsChildNodes = reviewedItems.childNodes as NodeListOf<HTMLElement>;

              reviewedItemsChildNodes.forEach((review) => {
                const by = review.querySelector('.by');

                if (by) {
                  const meta = by.querySelector('.item-meta');

                  // If there's book info, remove it
                  if (isNotNullish(meta) && meta.querySelector('.nowrap')) {
                    by.removeChild(meta);
                  }
                }
              });

              reviewedItemsContent = reviewedItems;
            }
          }

          const body = articleDom.window.document.querySelector(
            '.article-copy',
          );

          // Remove subscriber mask
          const articleMask = body?.querySelector('.article-mask');
          if (articleMask) body?.removeChild(articleMask);

          // If there's images, correctly load them
          body?.querySelectorAll('img').forEach((img) => {
            const appsrc = img.getAttribute('data-appsrc');

            if (isNotNullish(appsrc)) {
              // eslint-disable-next-line no-param-reassign
              img.src = `http://www.lrb.co.uk${appsrc}`;
            }
          });

          const innerHTMLWithArticle = `${
            dom.window.document.body.innerHTML
          }<div><h1>${h1}</h1><h2>${h2}</h2></div><div>${
            reviewedItemsContent.innerHTML
          }</div><div>${body?.innerHTML ?? ''}</div><br>End Article<br>`;

          dom.window.document.body.innerHTML = innerHTMLWithArticle;

          return undefined;
        }

        throw new Error('Unresolved path!');
      })
      .catch((err) => handleError(err));
  }

  try {
    fs.writeFileSync(
      `output/lrb/${publicationName} - ${volumeNumberAndDate}.html`,
      dom.window.document.body.innerHTML,
    );
  } catch (e: unknown) {
    console.error(e);
  }

  console.log('Fetching complete!');

  return {
    html: dom.window.document.body.innerHTML,
    volumeNumberAndDate,
    publicationName,
  };
}

const FIRST_SPLIT_INDEX = 0;
const SECOND_SPLIT_INDEX = 1;

function isAnchorElement(
  arg: ChildNode | HTMLAnchorElement,
): arg is HTMLAnchorElement {
  return 'href' in arg;
}

export default async function lrbParser(issueUrl: string) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl });

  // Get list of articles
  const result = await fetchContent(issueUrl, options);

  if (!isNotNullish(result)) {
    throw new Error('fetchContent error!');
  }

  const firstDateSplit = result.split('<div class="toc-cover-titles">');
  const secondDateSplit =
    firstDateSplit[SECOND_SPLIT_INDEX]?.split(
      '</div><div class="toc-cover-artist">',
    ) ?? [];

  const dateDom = new JSDOM('<!DOCTYPE html>');

  dateDom.window.document.body.innerHTML = `<div id="date-and-volume">${
    secondDateSplit[FIRST_SPLIT_INDEX] ?? ''
  }</div>`;

  const dateAndVolume = dateDom.window.document.getElementById(
    'date-and-volume',
  );

  const volumeNumberAndDate =
    dateAndVolume?.firstChild?.textContent ?? new Date().toLocaleDateString();

  const firstSplit = result.split('<div class="toc-content-holder">');

  const secondSplit =
    firstSplit[SECOND_SPLIT_INDEX]?.split(
      '</div><div class="toc-cover-artist toc-cover-artist--footer" aria-hidden="true">',
    ) ?? [];

  const dom = new JSDOM('<!DOCTYPE html>');
  dom.window.document.body.innerHTML = secondSplit[FIRST_SPLIT_INDEX] ?? '';

  const linksDiv = dom.window.document.body.querySelector('.toc-grid-items');

  const childNodes = Array.from(linksDiv?.childNodes ?? []);

  const hrefs = Array.from(childNodes)
    .map((link) => {
      if (isAnchorElement(link)) {
        return link.href;
      }

      return null;
    })
    .filter(isNotNullish);

  return processHrefs(hrefs, volumeNumberAndDate, options);
}
