'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const fs_1 = __importDefault(require('fs'));
const jsdom_1 = __importDefault(require('jsdom'));
const env_1 = __importDefault(require('../env'));
const { JSDOM } = jsdom_1.default;
const utils_1 = require('../utils');
const publicationName = "Harper's Magazine";
// const cookie = "wordpress_logged_in_XXX=XXX";
const { harpersCookie: cookie } = env_1.default;
async function processHrefs(hrefs, volumeNumberAndDate, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerHTML = `<h1>${publicationName} ${volumeNumberAndDate}</h1>`;
  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await utils_1
      .fetchContent(href, options)
      .then((result) => {
        if (!result) {
          throw new Error('fetchContent error!');
        }
        const articleDom = new JSDOM(result);
        const paywall = articleDom.window.document.getElementById(
          'leaky_paywall_message',
        );
        if (paywall) utils_1.throwCookieError();
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
          );
          const category = featureLayoutHeader.querySelector('.category');
          const categoryText = category.textContent;
          const byline = featureLayoutHeader.querySelector('.byline');
          const bylineLink = byline.querySelector('a');
          const author = bylineLink.textContent;
          const articleTitle = featureLayoutHeader.querySelector(
            '.article-title',
          );
          const subheading = featureLayoutHeader.querySelector('.subheading');
          const subheadingMarkup =
            (subheading === null || subheading === void 0
              ? void 0
              : subheading.outerHTML) || '';
          const picture = featureLayoutHeader.nextElementSibling;
          const pictureMarkup =
            (picture === null || picture === void 0
              ? void 0
              : picture.outerHTML) || '';
          const flexSections = articleLayoutFeature.querySelector(
            '.flex-sections',
          );
          // Fix img src path
          const images = flexSections.querySelectorAll('img');
          images.forEach((img) => {
            const oldSource = img.src;
            img.src = `https://www.harpers.orgflexSections${oldSource}`;
          });
          // Remove sidebar ad content
          const sidebars = flexSections.querySelectorAll('.col-md-4');
          sidebars.forEach((sidebar) => sidebar.remove());
          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div class="article-container"><div>${categoryText}</div>${articleTitle.outerHTML}<div>${author}</div><div>${subheadingMarkup}</div>${pictureMarkup}${flexSections.outerHTML}</div>`);
        } else if (articleLayoutSimple) {
          const simpleLayoutHeader = articleLayoutSimple.querySelector(
            '.article-header',
          );
          const category = simpleLayoutHeader.querySelector('.category');
          const categoryText = category.textContent;
          const title = simpleLayoutHeader.querySelector('.title');
          const byline = simpleLayoutHeader.querySelector('.byline');
          const author =
            (byline === null || byline === void 0
              ? void 0
              : byline.innerText) || '';
          const content = articleLayoutSimple.querySelectorAll(
            '.wysiwyg-content',
          );
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
          const headingMarkup =
            (heading === null || heading === void 0
              ? void 0
              : heading.outerHTML) || '';
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
      .catch((error) => utils_1.handleError(error));
  }
  fs_1.default.writeFile(
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
async function harpersParser(issueUrl) {
  const headers = {
    cookie,
  };
  const options = utils_1.getOptions({ headers, issueUrl });
  // Get list of articles from the Table of Contents
  // Q1/Q2 2020 redesign is a little all over the place
  // This does not grab the artwork they print anymore
  // It's a slideshow: .issue-slideshow
  return utils_1.fetchContent(issueUrl, options).then((result) => {
    if (!result) {
      throw new Error('fetchContent error!');
    }
    const dom = new JSDOM(result);
    const readings = dom.window.document.querySelector('.issue-readings');
    const readingsLinks = readings.querySelectorAll('a.ac-title');
    const readingsHrefs = Array.from(readingsLinks).map((a) => a.href);
    const articles = dom.window.document.querySelector('.issue-articles');
    const articleLinks = articles.querySelectorAll('a:not([rel="author"])');
    const articleHrefs = Array.from(
      new Set(Array.from(articleLinks).map((a) => a.href)),
    );
    const hrefs = [...readingsHrefs, ...articleHrefs];
    const header = dom.window.document.querySelector('h1');
    const volumeNumberAndDate = header.innerHTML;
    return processHrefs(hrefs, volumeNumberAndDate, options);
  });
}
exports.default = harpersParser;
