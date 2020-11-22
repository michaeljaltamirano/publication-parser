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
  dom.window.document.body.innerHTML = `<h1>${publicationName} ${volumeNumberAndDate}</h1>`;

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

        const harpersIndex = articleDom.window.document.querySelector(
          '.post-type-archive-index',
        );

        const findings = articleDom.window.document.querySelector(
          '.article-layout-finding',
        );

        if (articleLayoutFeature) {
          const featureLayoutHeader = articleLayoutFeature.querySelector(
            '.title-header.desktop',
          ) as HTMLElement;

          const picture = articleLayoutFeature.querySelector(
            '.article-hero-img',
          ) as HTMLElement;
          const pictureMarkup = picture?.outerHTML || '';

          const flexSections = articleLayoutFeature.querySelector(
            '.flex-sections',
          ) as HTMLElement;

          // Remove sidebar ad + other content
          const sidebarsMd = flexSections.querySelectorAll('.col-md-4');
          sidebarsMd.forEach((section) => section.remove());
          const sidebarsLg = flexSections.querySelectorAll('.col-lg-4');
          sidebarsLg.forEach((section) => section.remove());
          const afterPostContent = flexSections.querySelectorAll(
            '.after-post-content',
          );
          afterPostContent.forEach((section) => section.remove());
          const controls = flexSections.querySelectorAll(
            '.header-meta.header-controls',
          );
          controls.forEach((section) => section.remove());

          const content = Array.from(flexSections.children).reduce(
            (article, contentBlock) => {
              if (
                Array.from(contentBlock.classList).includes(
                  'after-post-content',
                )
              ) {
                return article;
              }

              if (contentBlock && contentBlock.outerHTML) {
                article += contentBlock.outerHTML;
              }

              return article;
            },
            '',
          );

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div className="article-container">${featureLayoutHeader.outerHTML}${pictureMarkup}${content}</div>`);
        } else if (articleLayoutSimple) {
          const simpleLayoutHeader = articleLayoutSimple.querySelector(
            '.article-header',
          ) as HTMLElement;

          const headerMeta = simpleLayoutHeader.querySelector('.header-meta');
          // Remove share article text
          headerMeta?.remove();

          const content = articleLayoutSimple.querySelectorAll<HTMLElement>(
            '.wysiwyg-content',
          );

          // Remove email signup block
          content.forEach((contentBlock) => {
            const afterPostContent = contentBlock.querySelectorAll(
              '.after-post-content',
            );

            afterPostContent.forEach((section) => section.remove());
          });

          const combinedContent = Array.from(content).reduce(
            (acc, arrContent) => {
              return (acc += Array.from(arrContent.children).reduce(
                (article, contentBlock) => {
                  article += contentBlock.outerHTML;
                  return article;
                },
                '',
              ));
            },
            '',
          );

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div className="article-container">${simpleLayoutHeader.outerHTML}${combinedContent}</div>`);
        } else if (harpersIndex) {
          const heading = harpersIndex.querySelector('h1');
          const headingMarkup = heading?.outerHTML || '';
          const body = harpersIndex.querySelector('.page-container');

          if (!body) {
            throw new Error(`Harper's Index error!`);
          }

          const linkedSources = body.querySelectorAll('.index-tooltip');
          linkedSources.forEach((linkedSource) => linkedSource.remove());

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div className="article-container">${headingMarkup}${body.outerHTML}</div>`);
        } else if (findings) {
          const content = findings.querySelector('.flex-sections');

          if (!content) {
            throw new Error('Findings error!');
          }

          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div className="article-container"><${content.outerHTML}</div>`);
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

    const readingsLinks = readings.querySelectorAll<HTMLAnchorElement>(
      'a.ac-title',
    );

    const readingsHrefs = Array.from(readingsLinks).map((a) => a.href);

    const articles = dom.window.document.querySelector(
      '.issue-articles',
    ) as HTMLElement;

    const articleLinks = articles.querySelectorAll<HTMLAnchorElement>(
      'a:not([rel="author"])',
    );

    const articleHrefs = Array.from(
      new Set(Array.from(articleLinks).map((a) => a.href)),
    );

    const hrefs = [...readingsHrefs, ...articleHrefs];

    const header = dom.window.document.querySelector('h1') as HTMLElement;

    const volumeNumberAndDate = header.innerHTML;

    return processHrefs(hrefs, volumeNumberAndDate, options);
  });
}
