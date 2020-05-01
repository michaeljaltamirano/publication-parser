var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
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
let volumeNumberAndDate;
const publicationName = "Harper's Magazine";
// const cookie = "wordpress_logged_in_XXX=XXX";
const { harpersCookie: cookie } = env_1.default;
function processHrefs(hrefs, options) {
  return __awaiter(this, void 0, void 0, function* () {
    const dom = new JSDOM(`<!DOCTYPE html>`);
    dom.window.document.body.innerText = `<h1>${publicationName} ${volumeNumberAndDate}</h1>`;
    for (const href of hrefs) {
      // Get articles
      console.log(`Fetching: ${href}`);
      yield utils_1
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
          if (articleLayoutFeature) {
            const featureLayoutHeader = articleLayoutFeature.querySelector(
              '.title-header.mobile',
            );
            const category = featureLayoutHeader.querySelector('.category');
            const categoryText = category.textContent;
            const byline = featureLayoutHeader
              .querySelector('.byline')
              .querySelector('a');
            const articleTitle = featureLayoutHeader.querySelector(
              '.article-title',
            );
            const author = byline.textContent;
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
  });
}
function harpersParser(issueUrl) {
  return __awaiter(this, void 0, void 0, function* () {
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
      const readingsLinks = dom.window.document
        .querySelector('.issue-readings')
        .querySelectorAll('a.ac-title');
      const readingsHrefs = Array.from(readingsLinks).map((a) => a.href);
      const articleLinks = dom.window.document
        .querySelector('.issue-articles')
        .querySelectorAll('a:not([rel="author"])');
      const articleHrefs = Array.from(
        new Set(Array.from(articleLinks).map((a) => a.href)),
      );
      const hrefs = [...readingsHrefs, ...articleHrefs];
      volumeNumberAndDate = dom.window.document.querySelector('h1').innerHTML;
      return processHrefs(hrefs, options);
    });
  });
}
exports.default = harpersParser;
