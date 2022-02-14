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
const jsdom_1 = __importDefault(require("jsdom"));
const env_1 = __importDefault(require("../env"));
const utils_1 = require("../utils");
const { JSDOM } = jsdom_1.default;
const baseUrl = 'https://www.lrb.co.uk';
const publicationName = 'The London Review of Books';
// const cookie = "lrb-session=XXX; lrb-remember-me=XXX;";
const { lrbCookie: cookie } = env_1.default;
const MIN_LENGTH = 0;
const generateNewJSDOM = () => new JSDOM('<!DOCTYPE html>');
const getReviewedItemsContent = (reviewedItemsHolder, reviewedItems) => {
    const newReviewedItems = reviewedItems.cloneNode(true);
    // Remove show more link
    const showMores = reviewedItemsHolder.querySelectorAll('.lrb-readmorelink');
    if (showMores.length > MIN_LENGTH)
        showMores.forEach((showMoreLink) => {
            showMoreLink.remove();
        });
    // Clean info
    const reviewedItemsChildNodes = newReviewedItems.childNodes;
    reviewedItemsChildNodes.forEach((review) => {
        const by = review.querySelector('.by');
        if (by) {
            const meta = by.querySelector('.item-meta');
            // If there's book info, remove it
            if (utils_1.isNotNullish(meta) && meta.querySelector('.nowrap')) {
                by.removeChild(meta);
            }
        }
    });
    return newReviewedItems;
};
const processArticle = (articleHeader, articleDom, dom) => {
    var _a, _b, _c, _d, _e;
    const h2 = (_b = (_a = articleHeader.firstChild) === null || _a === void 0 ? void 0 : _a.textContent) !== null && _b !== void 0 ? _b : '';
    const h3 = (_d = (_c = articleHeader.lastChild) === null || _c === void 0 ? void 0 : _c.textContent) !== null && _d !== void 0 ? _d : '';
    const reviewedItemsHolder = articleDom.window.document.querySelector('.reviewed-items-holder');
    let reviewedItemsContent = {
        innerHTML: '',
    };
    if (reviewedItemsHolder) {
        const reviewedItems = articleDom.window.document.querySelector('.reviewed-items');
        if (reviewedItems) {
            reviewedItemsContent = getReviewedItemsContent(reviewedItemsHolder, reviewedItems);
        }
    }
    const body = articleDom.window.document.querySelector('.article-copy');
    // Remove subscriber mask
    const articleMask = body === null || body === void 0 ? void 0 : body.querySelector('.article-mask');
    if (articleMask)
        body === null || body === void 0 ? void 0 : body.removeChild(articleMask);
    // If there's images, correctly load them
    body === null || body === void 0 ? void 0 : body.querySelectorAll('img').forEach((img) => {
        const appsrc = img.getAttribute('data-appsrc');
        if (utils_1.isNotNullish(appsrc)) {
            // eslint-disable-next-line no-param-reassign
            img.src = `http://www.lrb.co.uk${appsrc}`;
        }
    });
    const innerHTMLWithArticle = `${dom.window.document.body.innerHTML}<div><h2 class="chapter">${h2}</h2><h3>${h3}</h3></div><div>${reviewedItemsContent.innerHTML}</div><div>${(_e = body === null || body === void 0 ? void 0 : body.innerHTML) !== null && _e !== void 0 ? _e : ''}</div><br>End Article<br>`;
    dom.window.document.body.innerHTML = innerHTMLWithArticle;
};
const processContent = (articleDom, dom) => {
    var _a, _b;
    // If present, parse letters-specific page
    const lettersHeader = articleDom.window.document.getElementById('letters-heading-holder');
    if (lettersHeader) {
        const letters = articleDom.window.document.getElementById('lrb-lettersCopy');
        const lettersHeaderFirstChild = lettersHeader.firstChild;
        dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<h1>${(_a = lettersHeaderFirstChild === null || lettersHeaderFirstChild === void 0 ? void 0 : lettersHeaderFirstChild.innerHTML) !== null && _a !== void 0 ? _a : ''}</h1><div>${(_b = letters === null || letters === void 0 ? void 0 : letters.innerHTML) !== null && _b !== void 0 ? _b : ''}</div><br>End Letters<br>`;
        return undefined;
    }
    // Otherwise, parse regular article
    const articleHeader = articleDom.window.document.getElementById('article-heading-holder');
    if (articleHeader) {
        processArticle(articleHeader, articleDom, dom);
        return undefined;
    }
    throw new Error('Unresolved path!');
};
function processHrefs(hrefs, volumeNumberAndDate, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const dom = generateNewJSDOM();
        dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
        for (const item of hrefs) {
            // Get articles
            console.log(`Fetching: ${baseUrl}${item}`);
            try {
                const result = yield utils_1.fetchContent(`${baseUrl}${item}`, options);
                if (!utils_1.isNotNullish(result)) {
                    throw new Error('fetchContent error!');
                }
                const articleDom = generateNewJSDOM();
                articleDom.window.document.body.innerHTML = result;
                const isPaywalled = !!articleDom.window.document.getElementById('lrb-pw-block');
                if (isPaywalled)
                    utils_1.throwCookieError();
                processContent(articleDom, dom);
            }
            catch (e) {
                utils_1.handleError(e);
            }
        }
        utils_1.writeHtmlFile({
            html: dom.window.document.body.innerHTML,
            publicationName,
            shorthand: 'lrb',
            volumeNumberAndDate,
        });
        const epub = yield utils_1.getEpub({
            publicationName,
            shorthand: 'lrb',
            volumeNumberAndDate,
        });
        console.log('Fetching complete!');
        return {
            html: dom.window.document.body.outerHTML,
            epub,
            volumeNumberAndDate,
            publicationName,
        };
    });
}
const FIRST_SPLIT_INDEX = 0;
const SECOND_SPLIT_INDEX = 1;
function isAnchorElement(arg) {
    return 'href' in arg;
}
function lrbParser(issueUrl) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            cookie,
        };
        const options = utils_1.getOptions({ headers, issueUrl });
        // Get list of articles
        const result = yield utils_1.fetchContent(issueUrl, options);
        if (!utils_1.isNotNullish(result)) {
            throw new Error('fetchContent error!');
        }
        const firstDateSplit = result.split('<div class="toc-cover-titles">');
        const secondDateSplit = (_b = (_a = firstDateSplit[SECOND_SPLIT_INDEX]) === null || _a === void 0 ? void 0 : _a.split('</div><div class="toc-cover-artist">')) !== null && _b !== void 0 ? _b : [];
        const dateDom = generateNewJSDOM();
        dateDom.window.document.body.innerHTML = `<div id="date-and-volume">${(_c = secondDateSplit[FIRST_SPLIT_INDEX]) !== null && _c !== void 0 ? _c : ''}</div>`;
        const dateAndVolume = dateDom.window.document.getElementById('date-and-volume');
        const volumeNumberAndDate = (_e = (_d = dateAndVolume === null || dateAndVolume === void 0 ? void 0 : dateAndVolume.firstChild) === null || _d === void 0 ? void 0 : _d.textContent) !== null && _e !== void 0 ? _e : new Date().toLocaleDateString();
        const firstSplit = result.split('<div class="toc-content-holder">');
        const secondSplit = (_g = (_f = firstSplit[SECOND_SPLIT_INDEX]) === null || _f === void 0 ? void 0 : _f.split('</div><div class="toc-cover-artist toc-cover-artist--footer" aria-hidden="true">')) !== null && _g !== void 0 ? _g : [];
        const dom = generateNewJSDOM();
        dom.window.document.body.innerHTML = (_h = secondSplit[FIRST_SPLIT_INDEX]) !== null && _h !== void 0 ? _h : '';
        const linksDiv = dom.window.document.body.querySelector('.toc-grid-items');
        const childNodes = Array.from((_j = linksDiv === null || linksDiv === void 0 ? void 0 : linksDiv.childNodes) !== null && _j !== void 0 ? _j : []);
        const hrefs = Array.from(childNodes)
            .map((link) => {
            if (isAnchorElement(link)) {
                return link.href;
            }
            return null;
        })
            .filter(utils_1.isNotNullish);
        return processHrefs(hrefs, volumeNumberAndDate, options);
    });
}
exports.default = lrbParser;
