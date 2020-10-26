"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const jsdom_1 = __importDefault(require("jsdom"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const env_1 = __importDefault(require("../env"));
const { JSDOM } = jsdom_1.default;
const utils_1 = require("../utils");
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
async function processHrefs(hrefs, volumeNumberAndDate, options) {
    const dom = new JSDOM(`<!DOCTYPE html>`);
    dom.window.document.body.outerHTML = `<h1>${publicationName}, ${volumeNumberAndDate}</h1>`;
    for (const href of hrefs) {
        // Get articles
        console.log(`Fetching: ${href}`);
        await utils_1.fetchContent(href, options)
            .then(async (result) => {
            if (!result) {
                throw new Error('fetchContent error!');
            }
            const articleDom = new JSDOM(result);
            const body = articleDom.window.document.querySelector('body');
            const classList = Array.from(body.classList);
            const postId = classList.find((className) => className.indexOf('postid') !== -1);
            if (!postId)
                throw new Error('no postid found');
            const articleData = await node_fetch_1.default(`https://www.the-tls.co.uk/wp-json/tls/v2/single-article/${postId.replace(/\D/g, '')}`).then((res) => res.json());
            const { articleIntroPrimary, bookdetails, content, leadimage, paywallBanner, paywallStatus, } = articleData;
            if (paywallStatus === -1 || paywallBanner.text)
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
                ? bookdetails.map(({ authordetails, bookdetails, booktitle }) => {
                    return `
                <span>${booktitle}</span>
                <span>${bookdetails}</span>
                <span>By ${authordetails}</span>
            `;
                })
                : [];
            const cleanedReviewedItems = reviewedItems.filter((item) => item != null);
            const reviewBody = cleanedReviewedItems.length
                ? `
            <div>
                <span>In this Review:</span>

                <div>
                    ${cleanedReviewedItems.join('<br>')}
                </div>
            </div>
        `
                : '';
            // Remove iframe details
            const iframeStart = content.indexOf('<div class="tls-newsletter-iframe"');
            const iframeEnd = content.indexOf('</iframe>');
            let cleanContent = content;
            if (iframeStart !== -1 && iframeEnd !== -1) {
                const start = content.slice(0, iframeStart);
                const remainder = content.slice(iframeEnd + 9);
                cleanContent = start + remainder;
            }
            const contentBody = `
            <div>${cleanContent}</div>
        `;
            const articleMarkup = `<div class="article-container">${intro}<br>${introImage}<br>${reviewBody}<br><div>${contentBody}</div></div>`;
            return (dom.window.document.body.outerHTML = `${dom.window.document.body.outerHTML}${articleMarkup}`);
        })
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
}
async function tlsParser(issueUrl) {
    const headers = {
        cookie,
    };
    const options = utils_1.getOptions({ headers, issueUrl });
    // Get list of articles from the Table of Contents
    return utils_1.fetchContent(issueUrl, options).then(async (result) => {
        if (!result) {
            throw new Error('fetchContent error!');
        }
        const dom = new JSDOM(result);
        const body = dom.window.document.querySelector('body');
        const classList = Array.from(body.classList);
        const postId = classList.find((className) => className.indexOf('postid') !== -1);
        if (!postId)
            throw new Error('no postid found');
        const issueData = await node_fetch_1.default(`https://www.the-tls.co.uk/wp-json/tls/v2/contents-page/${postId.replace(/\D/g, '')}`).then((res) => res.json());
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
    });
}
exports.default = tlsParser;
