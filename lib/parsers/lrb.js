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
const baseUrl = 'https://www.lrb.co.uk';
const publicationName = 'The London Review of Books';
// const cookie = "lrb-session=XXX; lrb-remember-me=XXX;";
const { lrbCookie: cookie } = env_1.default;
async function processHrefs(hrefs, volumeNumberAndDate, options) {
    const dom = new JSDOM(`<!DOCTYPE html>`);
    dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
    for (const item of hrefs) {
        // Get articles
        console.log(`Fetching: ${baseUrl}${item}`);
        await utils_1.fetchContent(`${baseUrl}${item}`, options)
            .then((result) => {
            var _a, _b;
            if (!result) {
                throw new Error('fetchContent error!');
            }
            const articleDom = new JSDOM(`<!DOCTYPE html>`);
            articleDom.window.document.body.innerHTML = result;
            const isPaywalled = !!articleDom.window.document.getElementById('lrb-pw-block');
            if (isPaywalled)
                utils_1.throwCookieError();
            // If present, parse letters-specific page
            const lettersHeader = articleDom.window.document.getElementById('letters-heading-holder');
            // Otherwise, parse regular article
            const articleHeader = articleDom.window.document.getElementById('article-heading-holder');
            if (lettersHeader) {
                const letters = articleDom.window.document.getElementById('lrb-lettersCopy');
                const lettersHeaderFirstChild = lettersHeader.firstChild;
                return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<h1>${lettersHeaderFirstChild.innerHTML}</h1><div>${letters.innerHTML}</div><br>End Letters<br>`);
            }
            else if (articleHeader) {
                const h1 = (_a = articleHeader === null || articleHeader === void 0 ? void 0 : articleHeader.firstChild) === null || _a === void 0 ? void 0 : _a.textContent;
                const h2 = (_b = articleHeader === null || articleHeader === void 0 ? void 0 : articleHeader.lastChild) === null || _b === void 0 ? void 0 : _b.textContent;
                const reviewedItemsHolder = articleDom.window.document.querySelector('.reviewed-items-holder');
                let reviewedItemsContent = {
                    innerHTML: '',
                };
                if (reviewedItemsHolder) {
                    const reviewedItems = articleDom.window.document.querySelector('.reviewed-items');
                    if (reviewedItems) {
                        // Remove show more link
                        const showMores = reviewedItemsHolder.querySelectorAll('.lrb-readmorelink');
                        if (showMores)
                            showMores.forEach((showMoreLink) => showMoreLink.remove());
                        // Clean info
                        const reviewedItemsChildNodes = reviewedItems.childNodes;
                        reviewedItemsChildNodes.forEach((review) => {
                            const by = review.querySelector('.by');
                            if (by) {
                                const meta = by.querySelector('.item-meta');
                                // If there's book info, remove it
                                if (meta && meta.querySelector('.nowrap')) {
                                    by.removeChild(meta);
                                }
                            }
                        });
                        reviewedItemsContent = reviewedItems;
                    }
                }
                const body = articleDom.window.document.querySelector('.article-copy');
                // Remove subscriber mask
                const articleMask = body.querySelector('.article-mask');
                if (articleMask)
                    body.removeChild(articleMask);
                // If there's images, correctly load them
                body.querySelectorAll('img').forEach((img) => {
                    const srcset = img.getAttribute('data-srcset');
                    img.src = `http://www.lrb.co.uk${srcset}`;
                });
                const innerHTMLWithArticle = `${dom.window.document.body.innerHTML}<div><h1>${h1}</h1><h2>${h2}</h2></div><div>${reviewedItemsContent.innerHTML}</div><div>${body.innerHTML}</div><br>End Article<br>`;
                return (dom.window.document.body.innerHTML = innerHTMLWithArticle);
            }
            else {
                throw new Error('Unresolved path!');
            }
        })
            .catch((err) => utils_1.handleError(err));
    }
    fs_1.default.writeFile(`output/lrb/${publicationName} - ${volumeNumberAndDate}.html`, dom.window.document.body.innerHTML, (err) => {
        if (err)
            throw err;
    });
    console.log('Fetching complete!');
    return {
        html: dom.window.document.body.innerHTML,
        volumeNumberAndDate,
        publicationName,
    };
}
async function lrbParser(issueUrl) {
    const headers = {
        cookie,
    };
    const options = utils_1.getOptions({ headers, issueUrl });
    // Get list of articles
    return utils_1.fetchContent(issueUrl, options).then((result) => {
        var _a;
        if (!result) {
            throw new Error('fetchContent error!');
        }
        const firstDateSplit = result.split(`<div class="toc-cover-titles">`);
        const secondDateSplit = firstDateSplit[1].split(`</div><div class="toc-cover-artist">`);
        const dateDom = new JSDOM(`<!DOCTYPE html>`);
        dateDom.window.document.body.innerHTML = `<div id="date-and-volume">${secondDateSplit[0]}</div>`;
        const dateAndVolume = dateDom.window.document.getElementById('date-and-volume');
        const volumeNumberAndDate = ((_a = dateAndVolume === null || dateAndVolume === void 0 ? void 0 : dateAndVolume.firstChild) === null || _a === void 0 ? void 0 : _a.textContent) || new Date().toLocaleDateString();
        const firstSplit = result.split(`<div class="toc-content-holder">`);
        const secondSplit = firstSplit[1].split(`</div><div class="toc-cover-artist toc-cover-artist--footer" aria-hidden="true">`);
        const dom = new JSDOM(`<!DOCTYPE html>`);
        dom.window.document.body.innerHTML = secondSplit[0];
        const linksDiv = dom.window.document.body.querySelector('.toc-grid-items');
        const childNodes = Array.from(linksDiv.childNodes);
        const hrefs = Array.from(childNodes).map((link) => link.href);
        return processHrefs(hrefs, volumeNumberAndDate, options);
    });
}
exports.default = lrbParser;
