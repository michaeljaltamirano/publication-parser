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
const baseUrl = 'https://www.lrb.co.uk';
const publicationName = 'The London Review of Books';
// const cookie = "lrb-session=XXX; lrb-remember-me=XXX;";
const { lrbCookie: cookie } = env_1.default;
const MIN_LENGTH = 0;
function processHrefs(hrefs, volumeNumberAndDate, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const dom = new JSDOM('<!DOCTYPE html>');
        dom.window.document.body.innerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
        for (const item of hrefs) {
            // Get articles
            console.log(`Fetching: ${baseUrl}${item}`);
            yield utils_1.fetchContent(`${baseUrl}${item}`, options)
                .then((result) => {
                var _a, _b, _c, _d, _e, _f, _g;
                if (!utils_1.isNotNullish(result)) {
                    throw new Error('fetchContent error!');
                }
                const articleDom = new JSDOM('<!DOCTYPE html>');
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
                    dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<h1>${(_a = lettersHeaderFirstChild === null || lettersHeaderFirstChild === void 0 ? void 0 : lettersHeaderFirstChild.innerHTML) !== null && _a !== void 0 ? _a : ''}</h1><div>${(_b = letters === null || letters === void 0 ? void 0 : letters.innerHTML) !== null && _b !== void 0 ? _b : ''}</div><br>End Letters<br>`;
                    return undefined;
                }
                if (articleHeader) {
                    const h1 = (_d = (_c = articleHeader.firstChild) === null || _c === void 0 ? void 0 : _c.textContent) !== null && _d !== void 0 ? _d : '';
                    const h2 = (_f = (_e = articleHeader.lastChild) === null || _e === void 0 ? void 0 : _e.textContent) !== null && _f !== void 0 ? _f : '';
                    const reviewedItemsHolder = articleDom.window.document.querySelector('.reviewed-items-holder');
                    let reviewedItemsContent = {
                        innerHTML: '',
                    };
                    if (reviewedItemsHolder) {
                        const reviewedItems = articleDom.window.document.querySelector('.reviewed-items');
                        if (reviewedItems) {
                            // Remove show more link
                            const showMores = reviewedItemsHolder.querySelectorAll('.lrb-readmorelink');
                            if (showMores.length > MIN_LENGTH)
                                showMores.forEach((showMoreLink) => {
                                    showMoreLink.remove();
                                });
                            // Clean info
                            const reviewedItemsChildNodes = reviewedItems.childNodes;
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
                            reviewedItemsContent = reviewedItems;
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
                    const innerHTMLWithArticle = `${dom.window.document.body.innerHTML}<div><h1>${h1}</h1><h2>${h2}</h2></div><div>${reviewedItemsContent.innerHTML}</div><div>${(_g = body === null || body === void 0 ? void 0 : body.innerHTML) !== null && _g !== void 0 ? _g : ''}</div><br>End Article<br>`;
                    dom.window.document.body.innerHTML = innerHTMLWithArticle;
                    return undefined;
                }
                throw new Error('Unresolved path!');
            })
                .catch((err) => utils_1.handleError(err));
        }
        try {
            fs_1.default.writeFileSync(`output/lrb/${publicationName} - ${volumeNumberAndDate}.html`, dom.window.document.body.innerHTML);
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
        const dateDom = new JSDOM('<!DOCTYPE html>');
        dateDom.window.document.body.innerHTML = `<div id="date-and-volume">${(_c = secondDateSplit[FIRST_SPLIT_INDEX]) !== null && _c !== void 0 ? _c : ''}</div>`;
        const dateAndVolume = dateDom.window.document.getElementById('date-and-volume');
        const volumeNumberAndDate = (_e = (_d = dateAndVolume === null || dateAndVolume === void 0 ? void 0 : dateAndVolume.firstChild) === null || _d === void 0 ? void 0 : _d.textContent) !== null && _e !== void 0 ? _e : new Date().toLocaleDateString();
        const firstSplit = result.split('<div class="toc-content-holder">');
        const secondSplit = (_g = (_f = firstSplit[SECOND_SPLIT_INDEX]) === null || _f === void 0 ? void 0 : _f.split('</div><div class="toc-cover-artist toc-cover-artist--footer" aria-hidden="true">')) !== null && _g !== void 0 ? _g : [];
        const dom = new JSDOM('<!DOCTYPE html>');
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
