"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const jsdom_1 = __importDefault(require("jsdom"));
const env_1 = __importDefault(require("../env"));
const utils_1 = require("../utils");
const { JSDOM } = jsdom_1.default;
const publicationName = 'Bookforum';
// const cookie = "bfsid=XXX; login=XXX";
const { bookforumCookie: cookie } = env_1.default;
const getArticleString = (article) => {
    // Clear cruft: purchase links, social share links, anchor link formatting
    article.querySelectorAll('.book-info__purchase-links').forEach((el) => {
        // eslint-disable-next-line no-param-reassign
        el.innerHTML = '';
    });
    article.querySelectorAll('af-share-toggle').forEach((el) => {
        // eslint-disable-next-line no-param-reassign
        el.innerHTML = '';
    });
    const shareLinks = article.querySelectorAll('a.share');
    shareLinks.forEach((el) => {
        const parentNode = el.parentNode;
        if (utils_1.isNotNullish(parentNode)) {
            parentNode.innerHTML = el.innerHTML;
        }
    });
    // Src in form //www, prepend for proper rendering outside of browser
    article.querySelectorAll('img').forEach((image) => {
        // eslint-disable-next-line no-param-reassign
        image.src = `https:${image.src}`;
    });
    return `<div class="article-container">${article.innerHTML}</div>`;
};
function processHrefs(hrefs, volumeNumberAndDate, options) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const dom = new JSDOM('<!DOCTYPE html>');
        dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
        for (const href of hrefs) {
            // Get articles
            console.log(`Fetching: ${href}`);
            try {
                const result = yield utils_1.fetchContentArrayBuffer(`${href}`, options);
                if (!utils_1.isNotNullish(result)) {
                    throw new Error('fetchContentArrayBuffer error!');
                }
                const articleDom = new JSDOM(result);
                const paywall = articleDom.window.document.querySelector('.paywall');
                const paywallStyle = paywall === null || paywall === void 0 ? void 0 : paywall.getAttribute('style');
                const isPaywalled = (_a = paywallStyle === null || paywallStyle === void 0 ? void 0 : paywallStyle.includes('display: none')) !== null && _a !== void 0 ? _a : false;
                if (isPaywalled)
                    utils_1.throwCookieError();
                const article = articleDom.window.document.querySelector('.blog-article');
                if (article) {
                    const articleString = getArticleString(article);
                    dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}${articleString}`;
                }
                else {
                    throw new Error('Unresolved path!');
                }
            }
            catch (e) {
                utils_1.handleError(e);
            }
        }
        try {
            fs_1.default.writeFileSync(`output/bookforum/${publicationName} - ${volumeNumberAndDate}.html`, dom.window.document.body.innerHTML);
        }
        catch (e) {
            console.error(e);
        }
        console.log('Fetching complete!');
        return {
            html: dom.window.document.body.innerHTML,
            volumeNumberAndDate,
            publicationName,
        };
    });
}
function bookforumParser(issueUrl) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            cookie,
        };
        const options = utils_1.getOptions({ headers, issueUrl: `${issueUrl}` });
        // Get list of articles from the Table of Contents
        const result = yield utils_1.fetchContent(issueUrl, options);
        if (!utils_1.isNotNullish(result)) {
            throw new Error('fetchContent error!');
        }
        const dom = new JSDOM(result);
        const articleLinks = dom.window.document.querySelectorAll('.toc-article__link');
        // Clear duplicate links for feature headings
        const hrefs = Array.from(new Set(Array.from(articleLinks)
            .map((article) => {
            // Safe check to confirm article is HTMLAnchorElement
            if (article.href) {
                return article.href;
            }
            return null;
        })
            .filter(utils_1.isNotNullish)));
        const tocTitle = dom.window.document.querySelector('.toc-issue__title');
        const titleContent = (_a = tocTitle === null || tocTitle === void 0 ? void 0 : tocTitle.textContent) !== null && _a !== void 0 ? _a : '';
        // Cleans bookforum format--"Sep/Oct/Nov"--since those aren't directories
        const volumeNumberAndDate = titleContent.replace(/\//g, '-');
        return processHrefs(hrefs, volumeNumberAndDate, options);
    });
}
exports.default = bookforumParser;
