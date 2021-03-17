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
const node_fetch_1 = __importDefault(require("node-fetch"));
const env_1 = __importDefault(require("../env"));
const utils_1 = require("../utils");
const { JSDOM } = jsdom_1.default;
const publicationName = 'The Times Literary Supplement';
// const cookie = "main_access=XXX";
const { tlsCookie: cookie } = env_1.default;
const getArticleDetails = (details) => {
    const { label: { articletype, category: { text }, }, } = details;
    return {
        articletype,
        text,
    };
};
const getHeadingDetails = (details) => {
    const { byline, headline, standfirst: subheadline } = details;
    return {
        byline,
        headline,
        subheadline,
    };
};
const PAYWALL_ERROR = -1;
const FALSY_INDEX_OF = -1;
const STRING_START = 0;
const IFRAME_END_INDEX = 9;
function processHrefs(hrefs, volumeNumberAndDate, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const dom = new JSDOM('<!DOCTYPE html>');
        dom.window.document.body.outerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
        for (const href of hrefs) {
            // Get articles
            console.log(`Fetching: ${href}`);
            yield utils_1.fetchContent(href, options)
                .then((result) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                if (!utils_1.isNotNullish(result)) {
                    throw new Error('fetchContent error!');
                }
                const articleDom = new JSDOM(result);
                const body = articleDom.window.document.querySelector('body');
                const classList = Array.from((_a = body === null || body === void 0 ? void 0 : body.classList) !== null && _a !== void 0 ? _a : []);
                const postId = classList.find((className) => className.includes('postid'));
                if (!utils_1.isNotNullish(postId))
                    throw new Error('no postid found');
                const articleData = yield node_fetch_1.default(`https://www.the-tls.co.uk/wp-json/tls/v2/single-article/${postId.replace(/\D/g, '')}`).then((res) => __awaiter(this, void 0, void 0, function* () { return res.json(); }));
                const { articleIntroPrimary, bookdetails, content, leadimage, paywallBanner, paywallStatus, } = articleData;
                if (paywallStatus === PAYWALL_ERROR || utils_1.isNotNullish(paywallBanner.text))
                    utils_1.throwCookieError();
                const { articletype, text } = getArticleDetails(articleIntroPrimary);
                const subject = `${text} | ${articletype}`;
                const { byline, headline, subheadline } = getHeadingDetails(articleIntroPrimary);
                const intro = `
            <h4>${subject}</h4><br>
            <h2>${headline}</h2><br>
            <h3>${subheadline}</h3><br>
            ${byline.text ? `<h5>By ${byline.text}</h5><br>` : ''}
        `;
                const introImage = leadimage
                    ? `
            <div>
                <img src=${leadimage.url}></img>
                <span>${leadimage.imagecaption}</span>
            </div>
        `
                    : '';
                const reviewedItems = bookdetails
                    ? bookdetails.map(({ authordetails, bookdetails: innerBookDetails, booktitle }) => {
                        return `
                <span>${booktitle}</span>
                <span>${innerBookDetails}</span>
                <span>By ${authordetails}</span>
            `;
                    })
                    : [];
                // TODO: Determine what this was fixing
                // const cleanedReviewedItems = reviewedItems.filter(
                //   (item) => item != null,
                // );
                const reviewBody = reviewedItems.length
                    ? `
            <div>
                <span>In this Review:</span>

                <div>
                    ${reviewedItems.join('<br>')}
                </div>
            </div>
        `
                    : '';
                // Remove iframe details
                const iframeStart = content.indexOf('<div class="tls-newsletter-iframe"');
                const iframeEnd = content.indexOf('</iframe>');
                let cleanContent = content;
                if (iframeStart !== FALSY_INDEX_OF && iframeEnd !== FALSY_INDEX_OF) {
                    const start = content.slice(STRING_START, iframeStart);
                    const remainder = content.slice(iframeEnd + IFRAME_END_INDEX);
                    cleanContent = start + remainder;
                }
                /**
                 * Clean up affiliated link
                 */
                if (cleanContent.indexOf('<p><a href="https://www.google.com/url?q=https://shop.the-tls.co.uk/tls-latest-reviews')) {
                    const [newCleanContent] = cleanContent.split('<p><a href="https://www.google.com/url?q=https://shop.the-tls.co.uk/tls-latest-reviews');
                    if (utils_1.isNotNullish(newCleanContent)) {
                        cleanContent = newCleanContent;
                    }
                }
                if (cleanContent.indexOf('<p><a href="https://shop.the-tls.co.uk/tls-latest-reviews/')) {
                    const [newCleanContent] = cleanContent.split('<p><a href="https://shop.the-tls.co.uk/tls-latest-reviews/');
                    if (utils_1.isNotNullish(newCleanContent)) {
                        cleanContent = newCleanContent;
                    }
                }
                const contentBody = `
            <div>${cleanContent}</div>
        `;
                const articleMarkup = `<div class="article-container">${intro}<br>${introImage}<br>${reviewBody}<br><div>${contentBody}</div></div>`;
                dom.window.document.body.outerHTML = `${dom.window.document.body.outerHTML}${articleMarkup}`;
            }))
                .catch((error) => utils_1.handleError(error));
        }
        fs_1.default.writeFile(`output/tls/${publicationName} - ${volumeNumberAndDate}.html`, dom.window.document.body.outerHTML, (error) => {
            if (error)
                throw error;
        });
        console.log('Fetching complete!');
        return {
            html: dom.window.document.body.outerHTML,
            volumeNumberAndDate,
            publicationName,
        };
    });
}
function tlsParser(issueUrl) {
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
            const body = dom.window.document.querySelector('body');
            const classList = Array.from((_a = body === null || body === void 0 ? void 0 : body.classList) !== null && _a !== void 0 ? _a : []);
            const postId = classList.find((className) => className.includes('postid'));
            if (!utils_1.isNotNullish(postId))
                throw new Error('no postid found');
            const issueData = yield node_fetch_1.default(`https://www.the-tls.co.uk/wp-json/tls/v2/contents-page/${postId.replace(/\D/g, '')}`).then((res) => __awaiter(this, void 0, void 0, function* () {
                return res.json();
            }));
            const hrefs = [];
            const { contents, featuredarticle, issuedateline: { issuedate, issuenumber }, } = issueData;
            hrefs.push(featuredarticle.url);
            Object.entries(contents).forEach(([_key, content]) => {
                content.articleslist.forEach((list) => {
                    hrefs.push(list.url);
                });
            });
            const hrefsNoDuplicates = Array.from(new Set(hrefs));
            const volumeNumberAndDate = `${issuedate} - ${issuenumber}`;
            // Remove forward slashes from double issues
            const formattedVolumeNumberAndDate = volumeNumberAndDate.replace(/\//g, '+');
            return processHrefs(hrefsNoDuplicates, formattedVolumeNumberAndDate, options);
        }));
    });
}
exports.default = tlsParser;
