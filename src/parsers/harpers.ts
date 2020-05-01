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

let volumeNumberAndDate: string;
const publicationName = "Harper's Magazine";
// const cookie = "wordpress_logged_in_XXX=XXX";
const { harpersCookie: cookie } = ENV;

async function processHrefs(hrefs: string[], options: object) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerText = `<h1>${publicationName} ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContent(href, options)
      .then((result) => {
        if (!result) {
          throw new Error('fetchContent error!');
        }

        const articleDom = new JSDOM(result);

        const paywall = articleDom.window.document.getElementById(
          'leaky_paywall_message',
        );

        if (paywall) throwCookieError();

        const articleLayoutSimple = articleDom.window.document.querySelector(
          '.article-layout-simple',
        );
        const articleLayoutFeature = articleDom.window.document.querySelector(
          '.article-layout-featured',
        );

        if (articleLayoutFeature) {
          const featureLayoutHeader = <HTMLElement>(
            articleLayoutFeature.querySelector('.title-header.mobile')
          );

          const category = <HTMLElement>(
            featureLayoutHeader.querySelector('.category')
          );
          const categoryText = category.textContent;
          const byline = <HTMLElement>(
            featureLayoutHeader.querySelector('.byline').querySelector('a')
          );
          const articleTitle = featureLayoutHeader.querySelector(
            '.article-title',
          );
          const author = byline.textContent;
          const subheading = featureLayoutHeader.querySelector('.subheading');
          const subheadingMarkup = subheading?.outerHTML || '';

          const picture = <HTMLElement>featureLayoutHeader.nextElementSibling;
          const pictureMarkup = picture?.outerHTML || '';

          // const content = <NodeListOf<HTMLElement>>(
          //   articleDom.window.document.querySelectorAll('.wysiwyg-content')
          // );

          // const combinedContent = Array.from(content).reduce(
          //   (article, contentBlock) => {
          //     article += contentBlock.outerHTML;
          //     return article;
          //   },
          //   '',
          // );

          const flexSections = articleLayoutFeature.querySelector(
            '.flex-sections',
          );

          // Fix img src path
          const images = flexSections.querySelectorAll('img');
          images.forEach((img) => {
            console.log('what is imgsrc', img.src);
            const oldSource = img.src;
            img.src = `https://www.harpers.org${oldSource}`;
          });

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div class="article-container"><div>${categoryText}</div>${articleTitle.outerHTML}<div>${author}</div><div>${subheadingMarkup}</div>${picture.outerHTML}${flexSections.outerHTML}</div>`);
        } else if (articleLayoutSimple) {
          const simpleLayoutHeader = <HTMLElement>(
            articleLayoutSimple.querySelector('.article-header')
          );

          const category = <HTMLElement>(
            simpleLayoutHeader.querySelector('.category')
          );
          const categoryText = category.textContent;
          const title = <HTMLElement>simpleLayoutHeader.querySelector('.title');
          const byline = simpleLayoutHeader.querySelector('.byline') as
            | HTMLElement
            | undefined;

          const author = byline?.innerText || '';

          const content = <NodeListOf<HTMLElement>>(
            articleLayoutSimple.querySelectorAll('.wysiwyg-content')
          );

          // Fix img src path
          content.forEach((contentBlock) => {
            const images = contentBlock.querySelectorAll('img');

            images.forEach((img) => {
              console.log('what is imgsrc', img.src);
              const oldSource = img.src;
              img.src = `https://www.harpers.org${oldSource}`;
            });
          });

          const combinedContent = Array.from(content).reduce(
            (article, contentBlock) => {
              article += contentBlock.outerHTML;
              return article;
            },
            '',
          );

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div class="article-container"><div>${categoryText}</div><div>${title.outerHTML}</div><div>${author}</div><div>${combinedContent}</div></div>`);
        }
      })
      .catch((error) => handleError(error));
  }

  fs.writeFile(
    `output/harpers/${publicationName} - ${volumeNumberAndDate}.html`,
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

export default async function harpersParser(issueUrl: string) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl });

  // Get list of articles from the Table of Contents
  // Q1/Q2 2020 redesign is a little all over the place
  // This does not grab the artwork they print anymore
  // It's a slideshow: .issue-slideshow
  return fetchContent(issueUrl, options).then((result) => {
    if (!result) {
      throw new Error('fetchContent error!');
    }

    const dom = new JSDOM(result);

    const readingsLinks = <NodeListOf<HTMLAnchorElement>>(
      dom.window.document
        .querySelector('.issue-readings')
        .querySelectorAll('a.ac-title')
    );
    const readingsHrefs = Array.from(readingsLinks).map((a) => a.href);

    const articleLinks = <NodeListOf<HTMLAnchorElement>>(
      dom.window.document
        .querySelector('.issue-articles')
        .querySelectorAll('a:not([rel="author"])')
    );
    const articleHrefs = Array.from(
      new Set(Array.from(articleLinks).map((a) => a.href)),
    );

    const hrefs = [...readingsHrefs, ...articleHrefs];

    volumeNumberAndDate = dom.window.document.querySelector('h1').innerHTML;

    return processHrefs(hrefs, options);
  });
}
