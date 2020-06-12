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

const publicationName = "Harper's Magazine";
// const cookie = "wordpress_logged_in_XXX=XXX";
const { harpersCookie: cookie } = ENV;

async function processHrefs(
  hrefs: string[],
  volumeNumberAndDate: string,
  options: ReturnType<typeof getOptions>,
) {
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

        // TODO: Download this too
        const harpersIndex = articleDom.window.document.querySelector(
          '.post-type-archive-index',
        );

        const findings = articleDom.window.document.querySelector(
          '.article-layout-finding',
        );

        if (articleLayoutFeature) {
          const featureLayoutHeader = articleLayoutFeature.querySelector(
            '.title-header.mobile',
          ) as HTMLElement;

          const category = featureLayoutHeader.querySelector(
            '.category',
          ) as HTMLElement;
          const categoryText = category.textContent;
          const byline = featureLayoutHeader.querySelector(
            '.byline',
          ) as HTMLElement;
          const bylineLink = byline.querySelector('a') as HTMLElement;
          const author = bylineLink.textContent;
          const articleTitle = featureLayoutHeader.querySelector(
            '.article-title',
          ) as HTMLElement;
          const subheading = featureLayoutHeader.querySelector('.subheading');
          const subheadingMarkup = subheading?.outerHTML || '';

          const picture = featureLayoutHeader.nextElementSibling as HTMLElement;
          const pictureMarkup = picture?.outerHTML || '';

          const flexSections = articleLayoutFeature.querySelector(
            '.flex-sections',
          ) as HTMLElement;

          // Fix img src path
          const images = flexSections.querySelectorAll('img');
          images.forEach((img) => {
            const oldSource = img.src;
            img.src = `https://www.harpers.orgflexSections${oldSource}`;
          });

          // Remove sidebar ad content
          const sidebars = flexSections.querySelectorAll(
            '.col-md-4',
          ) as NodeListOf<HTMLElement>;
          sidebars.forEach((sidebar) => sidebar.remove());

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div class="article-container"><div>${categoryText}</div>${articleTitle.outerHTML}<div>${author}</div><div>${subheadingMarkup}</div>${pictureMarkup}${flexSections.outerHTML}</div>`);
        } else if (articleLayoutSimple) {
          const simpleLayoutHeader = articleLayoutSimple.querySelector(
            '.article-header',
          ) as HTMLElement;

          const category = simpleLayoutHeader.querySelector(
            '.category',
          ) as HTMLElement;
          const categoryText = category.textContent;
          const title = simpleLayoutHeader.querySelector(
            '.title',
          ) as HTMLElement;
          const byline = simpleLayoutHeader.querySelector('.byline') as
            | HTMLElement
            | undefined;

          const author = byline?.innerText || '';

          const content = articleLayoutSimple.querySelectorAll(
            '.wysiwyg-content',
          ) as NodeListOf<HTMLElement>;

          // Fix img src path
          content.forEach((contentBlock) => {
            const images = contentBlock.querySelectorAll('img');

            images.forEach((img) => {
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
        } else if (harpersIndex) {
          const heading = harpersIndex.querySelector('h1');
          const headingMarkup = heading?.outerHTML || '';
          const body = harpersIndex.querySelector('.page-container');

          if (!body) {
            throw new Error(`Harper's Index error!`);
          }

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div class="article-container">${headingMarkup}${body.outerHTML}</div>`);
        } else if (findings) {
          const content = findings.querySelector('.flex-sections');

          if (!content) {
            throw new Error('Findings error!');
          }

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div class="article-container"><${content.outerHTML}</div>`);
        } else {
          throw new Error('Unresolved path!');
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

    const readings = dom.window.document.querySelector(
      '.issue-readings',
    ) as HTMLElement;

    const readingsLinks = readings.querySelectorAll('a.ac-title') as NodeListOf<
      HTMLAnchorElement
    >;

    const readingsHrefs = Array.from(readingsLinks).map((a) => a.href);

    const articles = dom.window.document.querySelector(
      '.issue-articles',
    ) as HTMLElement;

    const articleLinks = articles.querySelectorAll(
      'a:not([rel="author"])',
    ) as NodeListOf<HTMLAnchorElement>;

    const articleHrefs = Array.from(
      new Set(Array.from(articleLinks).map((a) => a.href)),
    );

    const hrefs = [...readingsHrefs, ...articleHrefs];

    const header = dom.window.document.querySelector('h1') as HTMLElement;

    const volumeNumberAndDate = header.innerHTML;

    return processHrefs(hrefs, volumeNumberAndDate, options);
  });
}
