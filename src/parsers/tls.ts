import fs from 'fs';
import jsdom from 'jsdom';
import nodeFetch from 'node-fetch';
import ENV from '../env';
const { JSDOM } = jsdom;
import {
  fetchContent,
  getOptions,
  throwCookieError,
  handleError,
} from '../utils';

const publicationName = 'The Times Literary Supplement';
// const cookie = "main_access=XXX";
const { tlsCookie: cookie } = ENV;

type ArticleBody = {
  label: {
    articletype: string;
    category: {
      text: string;
    };
  };
  headline: string;
  standfirst: string;
  byline: {
    text: string;
  };
};

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

async function processHrefs(
  hrefs: string[],
  volumeNumberAndDate: string,
  options: any,
) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.outerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  dom.window.document.body.outerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContent(href, options)
      .then(async (result) => {
        if (!result) {
          throw new Error('fetchContent error!');
        }

        const articleDom = new JSDOM(result);

        const body = articleDom.window.document.querySelector(
          'body',
        ) as HTMLElement;
        const classList = Array.from(body.classList);

        const postId = classList.find(
          (className) => className.indexOf('postid') !== -1,
        );

        if (!postId) throw new Error('no postid found');

        const articleData = await nodeFetch(
          `https://www.the-tls.co.uk/wp-json/tls/v2/single-article/${postId.replace(
            /\D/g,
            '',
          )}`,
        ).then(
          (res) =>
            res.json() as Promise<{
              articleIntroPrimary: ArticleBody;
              bookdetails: Array<{
                authordetails: string;
                bookdetails: string;
                booktitle: string;
                imageurl: boolean;
                publisherdetails: string | '';
              }>;
              content: string;
              leadimage?: {
                imagecaption: string | '';
                imagecredit: string | '';
                url: string | '';
              };
              paywallStatus: number;
              paywallBanner: {
                loginUrl?: string;
                subscribeUrl?: string;
                text?: string;
              };
              topics: [];
            }>,
        );

        const {
          articleIntroPrimary,
          bookdetails,
          content,
          leadimage,
          paywallBanner,
          paywallStatus,
        } = articleData;

        if (paywallStatus === -1 || paywallBanner.text) throwCookieError();

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
          ? bookdetails.map(({ authordetails, bookdetails, booktitle }) => {
              return `
                <span>${booktitle}</span>
                <span>${bookdetails}</span>
                <span>By ${authordetails}</span>
            `;
            })
          : [];

        const cleanedReviewedItems = reviewedItems.filter(
          (item) => item != null,
        );

        const reviewBody = cleanedReviewedItems.length
          ? `
            <div>
                <span>In this Review:</span>

                <div>
                    ${cleanedReviewedItems.join('<br>')}
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

        if (iframeStart !== -1 && iframeEnd !== -1) {
          const start = content.slice(0, iframeStart);
          const remainder = content.slice(iframeEnd + 9);

          cleanContent = start + remainder;
        }

        const contentBody = `
            <div>${cleanContent}</div>
        `;

        const articleMarkup = `<div class="article-container">${intro}<br>${introImage}<br>${reviewBody}<br><div>${contentBody}</div></div>`;

        return (dom.window.document.body.outerHTML = `${dom.window.document.body.outerHTML}${articleMarkup}`);
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
    if (!result) {
      throw new Error('fetchContent error!');
    }

    const dom = new JSDOM(result);
    const body = dom.window.document.querySelector('body') as HTMLElement;
    const classList = Array.from(body.classList);

    const postId = classList.find(
      (className) => className.indexOf('postid') !== -1,
    );

    if (!postId) throw new Error('no postid found');

    const issueData = await nodeFetch(
      `https://www.the-tls.co.uk/wp-json/tls/v2/contents-page/${postId.replace(
        /\D/g,
        '',
      )}`,
    ).then(
      (res) =>
        res.json() as Promise<{
          contents: {
            [key: string]: {
              articleslist: Array<{ url: string }>;
            };
          };
          featuredarticle: { url: string };
          highlights: Array<{ url: string }>; // repeated in contents
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

    return processHrefs(hrefsNoDuplicates, volumeNumberAndDate, options);
  });
}
