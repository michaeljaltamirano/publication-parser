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
const publicationName = 'Bookforum';
// const cookie = "bfsid=XXX; login=XXX";
const { bookforumCookie: cookie } = env_1.default;
function processHrefs(hrefs, volumeNumberAndDate, options) {
  return __awaiter(this, void 0, void 0, function* () {
    const dom = new JSDOM(`<!DOCTYPE html>`);
    dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
    for (const href of hrefs) {
      // Get articles
      console.log(`Fetching: ${href}`);
      yield utils_1
        .fetchContentArrayBuffer(`${href}`, options)
        .then((result) => {
          if (!result) {
            throw new Error('fetchContentArrayBuffer error!');
          }
          const articleDom = new JSDOM(result);
          const paywall = articleDom.window.document.querySelector('.paywall');
          const paywallStyle =
            paywall === null || paywall === void 0
              ? void 0
              : paywall.getAttribute('style');
          const isPaywalled =
            paywallStyle && paywallStyle.includes('display: none');
          if (isPaywalled) utils_1.throwCookieError();
          const article = articleDom.window.document.querySelector(
            '.blog-article',
          );
          if (article) {
            // Clear cruft: purchase links, social share links, anchor link formatting
            article
              .querySelectorAll('.book-info__purchase-links')
              .forEach((el) => (el.innerHTML = ''));
            article
              .querySelectorAll('af-share-toggle')
              .forEach((el) => (el.innerHTML = ''));
            article.querySelectorAll('a.share').forEach((el) => {
              const parentNode = el.parentNode;
              if (parentNode.innerHTML) {
                parentNode.innerHTML = el.innerHTML;
              }
            });
            // Src in form //www, prepend for proper rendering outside of browser
            article
              .querySelectorAll('img')
              .forEach((image) => (image.src = `https:${image.src}`));
            const articleString = `${dom.window.document.body.innerHTML}<div class="article-container">${article.innerHTML}</div>`;
            dom.window.document.body.innerHTML = articleString;
          }
        })
        .catch((err) => utils_1.handleError(err));
    }
    fs_1.default.writeFile(
      `output/bookforum/${publicationName} - ${volumeNumberAndDate}.html`,
      dom.window.document.body.innerHTML,
      (err) => {
        if (err) throw err;
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
function bookforumParser(issueUrl) {
  return __awaiter(this, void 0, void 0, function* () {
    const headers = {
      cookie,
    };
    const options = utils_1.getOptions({ headers, issueUrl: `${issueUrl}` });
    // Get list of articles from the Table of Contents
    return utils_1.fetchContent(issueUrl, options).then((result) => {
      if (!result) {
        throw new Error('fetchContent error!');
      }
      const dom = new JSDOM(result);
      const articleLinks = dom.window.document.querySelectorAll(
        '.toc-article__link',
      );
      // Clear duplicate links for feature headings
      const hrefs = Array.from(
        new Set(
          Array.from(articleLinks).map((article) => {
            // Safe check to confirm article is HTMLAnchorElement
            if (article.href) {
              return article.href;
            }
          }),
        ),
      );
      // Cleans bookforum format--"Sep/Oct/Nov"--since those aren't directories
      const volumeNumberAndDate = dom.window.document
        .querySelector('.toc-issue__title')
        .textContent.replace(/\//g, '-');
      return processHrefs(hrefs, volumeNumberAndDate, options);
    });
  });
}
exports.default = bookforumParser;