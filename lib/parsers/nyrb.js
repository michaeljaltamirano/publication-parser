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
const publicationName = 'The New York Review of Books';
// const cookie = "wordpress_logged_in_XXX=XXX";
const { nyrbCookie: cookie } = env_1.default;
function processHrefs(hrefs, options) {
  return __awaiter(this, void 0, void 0, function* () {
    const dom = new JSDOM(`<!DOCTYPE html>`);
    dom.window.document.body.innerText = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
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
          const paywall = articleDom.window.document.querySelector('.paywall');
          if (paywall) utils_1.throwCookieError();
          const article = articleDom.window.document.querySelector(
            'article.article',
          );
          const header = article.querySelector('header');
          const body = article.querySelector('section.article_body');
          // remove timestamp
          article.querySelector('article > header > .details').innerHTML = '';
          // remove amazon links and publishing info
          const reviewedItems = body.querySelector('.reviewed_articles');
          if (reviewedItems) {
            reviewedItems.querySelectorAll('article').forEach((article) => {
              const h4 = article.querySelector('h4');
              const details = article.querySelector('.details');
              if (h4) {
                const a = h4.querySelector('a');
                if (a) {
                  const itemInfo = a.innerText;
                  h4.removeChild(a);
                  const item = articleDom.window.document.createElement('b');
                  item.innerText = itemInfo;
                  article.prepend(item);
                }
              }
              if (details) {
                article.removeChild(details);
              }
            });
          }
          // Remove list item span numbers
          const footnotes = article.querySelector('.footnotes');
          if (footnotes) {
            footnotes.querySelectorAll('li').forEach((listItem) => {
              const span = listItem.querySelector('span');
              if (span) listItem.removeChild(span);
            });
          }
          return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div class="article-container">${header.innerHTML}${body.innerHTML}</div>`);
        })
        .catch((error) => utils_1.handleError(error));
    }
    fs_1.default.writeFile(
      `output/nyrb/${publicationName} - ${volumeNumberAndDate}.html`,
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
function nyrbParser(issueUrl) {
  return __awaiter(this, void 0, void 0, function* () {
    const headers = {
      cookie,
    };
    const options = utils_1.getOptions({ headers, issueUrl });
    // Get list of articles from the Table of Contents
    return utils_1.fetchContent(issueUrl, options).then((result) => {
      if (!result) {
        throw new Error('fetchContent error!');
      }
      const dom = new JSDOM(result);
      const tableOfContentsH2s = dom.window.document.querySelectorAll('h2');
      let hrefs = [];
      tableOfContentsH2s.forEach((h2) => {
        const a = h2.querySelector('a');
        if (a) {
          hrefs.push(a.href);
        }
      });
      volumeNumberAndDate = dom.window.document.querySelector('time').innerHTML;
      return processHrefs(hrefs, options);
    });
  });
}
exports.default = nyrbParser;
module.exports = nyrbParser;
