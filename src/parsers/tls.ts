import fs from 'fs';
import jsdom from 'jsdom';
import nodeFetch from 'node-fetch';
import ENV from '../env';
import {
  fetchContent,
  getOptions,
  throwCookieError,
  handleError,
  isNotNullish,
} from '../utils';

const { JSDOM } = jsdom;

const publicationName = 'The Times Literary Supplement';
// const cookie = "main_access=XXX";
const { tlsCookie: cookie } = ENV;

interface ArticleBody {
  byline: {
    text: string;
  };
  headline: string;
  label: {
    articletype: string;
    category: {
      text: string;
    };
  };
  standfirst: string;
}

const getArticleDetails = (details: ArticleBody) => {
  const {
    label: {
      articletype,
      category: { text },
    },
  } = details;

  return {
    articletype,
    text,
  };
};

const getHeadingDetails = (details: ArticleBody) => {
  const { byline, headline, standfirst: subheadline } = details;

  return {
    byline,
    headline,
    subheadline,
  };
};

const PAYWALL_ERROR = -1;
const FALSY_INDEX_OF = -1;
const STRING_START = 0;
const IFRAME_END_INDEX = 9;

async function processHrefs(
  hrefs: string[],
  volumeNumberAndDate: string,
  options: Record<string, unknown>,
) {
  const dom = new JSDOM('<!DOCTYPE html>');
  dom.window.document.body.outerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContent(href, options)
      .then(async (result) => {
        if (!isNotNullish(result)) {
          throw new Error('fetchContent error!');
        }

        const articleDom = new JSDOM(result);

        const body = articleDom.window.document.querySelector('body');
        const classList = Array.from(body?.classList ?? []);

        const postId = classList.find((className) =>
          className.includes('postid'),
        );

        if (!isNotNullish(postId)) throw new Error('no postid found');

        const articleData = await nodeFetch(
          `https://www.the-tls.co.uk/wp-json/tls/v2/single-article/${postId.replace(
            /\D/g,
            '',
          )}`,
        ).then<{
          articleIntroPrimary: ArticleBody;
          bookdetails?: {
            authordetails: string;
            bookdetails: string;
            booktitle: string;
            imageurl: boolean;
            publisherdetails: string | '';
          }[];
          content: string;
          leadimage?: {
            imagecaption: string | '';
            imagecredit: string | '';
            url: string | '';
          };
          paywallBanner: {
            loginUrl?: string;
            subscribeUrl?: string;
            text?: string;
          };
          paywallStatus: number;
          topics: [];
        }>(async (res) => res.json());

        const {
          articleIntroPrimary,
          bookdetails,
          content,
          leadimage,
          paywallBanner,
          paywallStatus,
        } = articleData;

        if (paywallStatus === PAYWALL_ERROR || isNotNullish(paywallBanner.text))
          throwCookieError();

        const { articletype, text } = getArticleDetails(articleIntroPrimary);

        const subject = `${text} | ${articletype}`;

        const { byline, headline, subheadline } = getHeadingDetails(
          articleIntroPrimary,
        );

        const intro = `
            <h4>${subject}</h4><br>
            <h2>${headline}</h2><br>
            <h3>${subheadline}</h3><br>
            ${byline.text ? `<h5>By ${byline.text}</h5><br>` : ''}
        `;

        const introImage = leadimage
          ? `
            <div>
                <img src=${leadimage.url}></img>
                <span>${leadimage.imagecaption}</span>
            </div>
        `
          : '';

        const reviewedItems = bookdetails
          ? bookdetails.map(
              ({ authordetails, bookdetails: innerBookDetails, booktitle }) => {
                return `
                <span>${booktitle}</span>
                <span>${innerBookDetails}</span>
                <span>By ${authordetails}</span>
            `;
              },
            )
          : [];

        // TODO: Determine what this was fixing
        // const cleanedReviewedItems = reviewedItems.filter(
        //   (item) => item != null,
        // );

        const reviewBody = reviewedItems.length
          ? `
            <div>
                <span>In this Review:</span>

                <div>
                    ${reviewedItems.join('<br>')}
                </div>
            </div>
        `
          : '';

        // Remove iframe details
        const iframeStart = content.indexOf(
          '<div class="tls-newsletter-iframe"',
        );
        const iframeEnd = content.indexOf('</iframe>');

        let cleanContent = content;

        if (iframeStart !== FALSY_INDEX_OF && iframeEnd !== FALSY_INDEX_OF) {
          const start = content.slice(STRING_START, iframeStart);
          const remainder = content.slice(iframeEnd + IFRAME_END_INDEX);

          cleanContent = start + remainder;
        }

        /**
         * Clean up affiliated link
         */
        if (
          cleanContent.indexOf(
            '<p><a href="https://www.google.com/url?q=https://shop.the-tls.co.uk/tls-latest-reviews',
          )
        ) {
          const [newCleanContent] = cleanContent.split(
            '<p><a href="https://www.google.com/url?q=https://shop.the-tls.co.uk/tls-latest-reviews',
          );

          if (isNotNullish(newCleanContent)) {
            cleanContent = newCleanContent;
          }
        }

        if (
          cleanContent.indexOf(
            '<p><a href="https://shop.the-tls.co.uk/tls-latest-reviews/',
          )
        ) {
          const [newCleanContent] = cleanContent.split(
            '<p><a href="https://shop.the-tls.co.uk/tls-latest-reviews/',
          );
          if (isNotNullish(newCleanContent)) {
            cleanContent = newCleanContent;
          }
        }

        const contentBody = `
            <div>${cleanContent}</div>
        `;

        const articleMarkup = `<div class="article-container">${intro}<br>${introImage}<br>${reviewBody}<br><div>${contentBody}</div></div>`;

        dom.window.document.body.outerHTML = `${dom.window.document.body.outerHTML}${articleMarkup}`;
      })
      .catch((error) => handleError(error));
  }

  fs.writeFile(
    `output/tls/${publicationName} - ${volumeNumberAndDate}.html`,
    dom.window.document.body.outerHTML,
    (error) => {
      if (error) throw error;
    },
  );

  console.log('Fetching complete!');

  return {
    html: dom.window.document.body.outerHTML,
    volumeNumberAndDate,
    publicationName,
  };
}

export default async function tlsParser(issueUrl: string) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl });

  // Get list of articles from the Table of Contents
  return fetchContent(issueUrl, options).then(async (result) => {
    if (!isNotNullish(result)) {
      throw new Error('fetchContent error!');
    }

    const dom = new JSDOM(result);
    const body = dom.window.document.querySelector('body');
    const classList = Array.from(body?.classList ?? []);

    const postId = classList.find((className) => className.includes('postid'));

    if (!isNotNullish(postId)) throw new Error('no postid found');

    const issueData = await nodeFetch(
      `https://www.the-tls.co.uk/wp-json/tls/v2/contents-page/${postId.replace(
        /\D/g,
        '',
      )}`,
    ).then(
      async (res) =>
        res.json() as Promise<{
          contents: Record<
            string,
            {
              articleslist: { url: string }[];
            }
          >;
          featuredarticle: { url: string };
          highlights: { url: string }[]; // repeated in contents
          issuedateline: {
            issuedate: string;
            issuenumber: string;
          };
        }>,
    );

    const hrefs: string[] = [];

    const {
      contents,
      featuredarticle,
      issuedateline: { issuedate, issuenumber },
    } = issueData;

    hrefs.push(featuredarticle.url);

    Object.entries(contents).forEach(([_key, content]) => {
      content.articleslist.forEach((list) => {
        hrefs.push(list.url);
      });
    });

    const hrefsNoDuplicates = Array.from(new Set(hrefs));

    const volumeNumberAndDate = `${issuedate} - ${issuenumber}`;

    // Remove forward slashes from double issues
    const formattedVolumeNumberAndDate = volumeNumberAndDate.replace(
      /\//g,
      '+',
    );

    return processHrefs(
      hrefsNoDuplicates,
      formattedVolumeNumberAndDate,
      options,
    );
  });
}
