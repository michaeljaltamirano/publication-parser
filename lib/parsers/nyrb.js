"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const jsdom_1 = __importDefault(require("jsdom"));
const env_1 = __importDefault(require("../env"));
const { JSDOM } = jsdom_1.default;
const utils_1 = require("../utils");
const publicationName = 'The New York Review of Books';
// const cookie = "wordpress_logged_in_XXX=XXX";
const { nyrbCookie: cookie } = env_1.default;
async function processHrefs(hrefs, volumeNumberAndDate, options) {
    const dom = new JSDOM(`<!DOCTYPE html>`);
    dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
    for (const href of hrefs) {
        // Get articles
        console.log(`Fetching: ${href}`);
        await utils_1.fetchContent(href, options)
            .then((result) => {
            if (!result) {
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
            const titleAndAuthorMarkup = `<heading>${(title === null || title === void 0 ? void 0 : title.outerHTML) || ''}</heading><h2>${(author === null || author === void 0 ? void 0 : author.textContent) || ''}</h2><h3>${(dek === null || dek === void 0 ? void 0 : dek.outerHTML) || ''}</h3>`;
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
            if (!body) {
                throw new Error('No article body!');
            }
            const bodyMarkup = Array.from(body).reduce((acc, markup) => {
                const nodes = Array.from(markup.childNodes);
                acc = nodes.reduce((acc, node) => {
                    if (!node.outerHTML ||
                        (node.classList &&
                            Array.from(node.classList).includes('inline-ad')))
                        return acc;
                    return (acc += node.outerHTML);
                }, '');
                return acc;
            }, '');
            const authorInfo = article.querySelector('.author-info > p');
            return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<div class="article-container">${titleAndAuthorMarkup}${(reviewedItems === null || reviewedItems === void 0 ? void 0 : reviewedItems.outerHTML) || ''}${bodyMarkup}${(authorInfo === null || authorInfo === void 0 ? void 0 : authorInfo.outerHTML) || ''}</div>`);
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
}
async function nyrbParser(issueUrl) {
    const headers = {
        cookie,
    };
    const options = utils_1.getOptions({ headers, issueUrl });
    // Get list of articles from the Table of Contents
    return utils_1.fetchContent(issueUrl, options).then((result) => {
        var _a;
        if (!result) {
            throw new Error('fetchContent error!');
        }
        const dom = new JSDOM(result);
        const tableOfContentsLinks = dom.window.document.querySelectorAll('a[href*="nybooks.com/articles"]');
        const hrefs = Array.from(tableOfContentsLinks).map((link) => link.href);
        const date = (_a = dom.window.document.querySelector('header.issue_header > p.h2')) === null || _a === void 0 ? void 0 : _a.textContent;
        if (!date) {
            throw new Error('Issue date parsing error');
        }
        return processHrefs(hrefs, date, options);
    });
}
exports.default = nyrbParser;
