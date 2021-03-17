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
const publicationName = 'The New York Review of Books';
// const cookie = "wordpress_logged_in_XXX=XXX";
const { nyrbCookie: cookie } = env_1.default;
function processHrefs(hrefs, volumeNumberAndDate, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const dom = new JSDOM('<!DOCTYPE html>');
        dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
        for (const href of hrefs) {
            // Get articles
            console.log(`Fetching: ${href}`);
            yield utils_1.fetchContent(href, options)
                .then((result) => {
                var _a, _b, _c, _d, _e;
                if (!utils_1.isNotNullish(result)) {
                    throw new Error('fetchContent error!');
                }
                const articleDom = new JSDOM(result);
                const paywall = articleDom.window.document.querySelector('.paywall');
                if (paywall)
                    utils_1.throwCookieError();
                const header = articleDom.window.document.querySelector('header[class*="article-header"]');
                if (!header) {
                    throw new Error('header parse error');
                }
                const title = header.querySelector('h1');
                const author = header.querySelector('div.author');
                const dek = header.querySelector('div.dek:not(.author)');
                const titleAndAuthorMarkup = `<heading>${(_a = title === null || title === void 0 ? void 0 : title.outerHTML) !== null && _a !== void 0 ? _a : ''}</heading><h2>${(_b = author === null || author === void 0 ? void 0 : author.textContent) !== null && _b !== void 0 ? _b : ''}</h2><h3>${(_c = dek === null || dek === void 0 ? void 0 : dek.outerHTML) !== null && _c !== void 0 ? _c : ''}</h3>`;
                const article = articleDom.window.document.querySelector('article.article');
                if (!article) {
                    throw new Error('article parse error');
                }
                const reviewedItems = article.querySelector('.review-items');
                // The only content we're interested in is in the first div.row in <article>
                const firstRow = article.querySelector('.row');
                if (!firstRow) {
                    throw new Error('row parse error');
                }
                /**
                 * Includes:
                 *
                 * 1. Letters to the editors "In response to:" preface
                 * 2. Any preface ("addendum") to the article body (e.g. "This article is part of...")
                 * 3. Article body
                 */
                const body = firstRow.querySelectorAll('div.article-col');
                if (!utils_1.isNotNullish(body)) {
                    throw new Error('No article body!');
                }
                const bodyMarkup = Array.from(body).reduce((_acc, markup) => {
                    const nodes = Array.from(markup.childNodes);
                    return nodes.reduce((innerAcc, node) => {
                        if (!node.outerHTML ||
                            (utils_1.isNotNullish(node.classList) &&
                                Array.from(node.classList).includes('inline-ad')))
                            return innerAcc;
                        return innerAcc + node.outerHTML;
                    }, '');
                }, '');
                const authorInfo = article.querySelector('.author-info > p');
                dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div class="article-container">${titleAndAuthorMarkup}${(_d = reviewedItems === null || reviewedItems === void 0 ? void 0 : reviewedItems.outerHTML) !== null && _d !== void 0 ? _d : ''}${bodyMarkup}${(_e = authorInfo === null || authorInfo === void 0 ? void 0 : authorInfo.outerHTML) !== null && _e !== void 0 ? _e : ''}</div>`;
            })
                .catch((error) => utils_1.handleError(error));
        }
        fs_1.default.writeFile(`output/nyrb/${publicationName} - ${volumeNumberAndDate}.html`, dom.window.document.body.innerHTML, (error) => {
            if (error)
                throw error;
        });
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
        return utils_1.fetchContent(issueUrl, options).then((result) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!utils_1.isNotNullish(result)) {
                throw new Error('fetchContent error!');
            }
            const dom = new JSDOM(result);
            const tableOfContentsLinks = dom.window.document.querySelectorAll('a[href*="nybooks.com/articles"]');
            const hrefs = Array.from(tableOfContentsLinks).map((link) => link.href);
            const date = (_a = dom.window.document.querySelector('header.issue_header > p.h2')) === null || _a === void 0 ? void 0 : _a.textContent;
            if (!utils_1.isNotNullish(date)) {
                throw new Error('Issue date parsing error');
            }
            return processHrefs(hrefs, date, options);
        }));
    });
}
exports.default = nyrbParser;
