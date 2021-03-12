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
const publicationName = "Harper's Magazine";
// const cookie = "wordpress_logged_in_XXX=XXX";
const { harpersCookie: cookie } = env_1.default;
async function processHrefs(hrefs, volumeNumberAndDate, options) {
    const dom = new JSDOM(`<!DOCTYPE html>`);
    dom.window.document.body.innerHTML = `<h1>${publicationName} ${volumeNumberAndDate}</h1>`;
    for (const href of hrefs) {
        // Get articles
        console.log(`Fetching: ${href}`);
        await utils_1.fetchContent(href, options)
            .then((result) => {
            if (!result) {
                throw new Error('fetchContent error!');
            }
            const articleDom = new JSDOM(result);
            const paywall = articleDom.window.document.getElementById('leaky_paywall_message');
            if (paywall)
                utils_1.throwCookieError();
            const articleLayoutSimple = articleDom.window.document.querySelector('.article-layout-simple');
            const articleLayoutFeature = articleDom.window.document.querySelector('.article-layout-featured');
            const harpersIndex = articleDom.window.document.querySelector('.post-type-archive-index');
            const findings = articleDom.window.document.querySelector('.article-layout-finding');
            if (articleLayoutFeature) {
                const featureLayoutHeader = articleLayoutFeature.querySelector('.title-header.desktop');
                const picture = articleLayoutFeature.querySelector('.article-hero-img');
                const pictureMarkup = (picture === null || picture === void 0 ? void 0 : picture.outerHTML) || '';
                const flexSections = articleLayoutFeature.querySelector('.flex-sections');
                if (flexSections) {
                    // Remove sidebar ad + other content
                    const sidebarsMd = flexSections.querySelectorAll('.col-md-4');
                    sidebarsMd.forEach((section) => section.remove());
                    const sidebarsLg = flexSections.querySelectorAll('.col-lg-4');
                    sidebarsLg.forEach((section) => section.remove());
                    const afterPostContent = flexSections.querySelectorAll('.after-post-content');
                    afterPostContent.forEach((section) => section.remove());
                    const controls = flexSections.querySelectorAll('.header-meta.header-controls');
                    controls.forEach((section) => section.remove());
                    const content = Array.from(flexSections.children).reduce((article, contentBlock) => {
                        if (Array.from(contentBlock.classList).includes('after-post-content')) {
                            return article;
                        }
                        if (contentBlock && contentBlock.outerHTML) {
                            article += contentBlock.outerHTML;
                        }
                        return article;
                    }, '');
                    return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article>${featureLayoutHeader.outerHTML}${pictureMarkup}${content}</article>`);
                }
                else {
                    console.log('no flexSections found');
                    return;
                }
            }
            else if (articleLayoutSimple) {
                const simpleLayoutHeader = articleLayoutSimple.querySelector('.article-header');
                const headerMeta = simpleLayoutHeader.querySelector('.header-meta');
                // Remove share article text
                headerMeta === null || headerMeta === void 0 ? void 0 : headerMeta.remove();
                const content = articleLayoutSimple.querySelectorAll('.wysiwyg-content');
                // Remove email signup block
                content.forEach((contentBlock) => {
                    const afterPostContent = contentBlock.querySelectorAll('.after-post-content');
                    afterPostContent.forEach((section) => section.remove());
                });
                const combinedContent = Array.from(content).reduce((acc, arrContent) => {
                    return (acc += Array.from(arrContent.children).reduce((article, contentBlock) => {
                        article += contentBlock.outerHTML;
                        return article;
                    }, ''));
                }, '');
                return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article>${simpleLayoutHeader.outerHTML}${combinedContent}</article>`);
            }
            else if (harpersIndex) {
                const heading = harpersIndex.querySelector('h1');
                const headingMarkup = (heading === null || heading === void 0 ? void 0 : heading.outerHTML) || '';
                const body = harpersIndex.querySelector('.page-container');
                if (!body) {
                    throw new Error(`Harper's Index error!`);
                }
                const linkedSources = body.querySelectorAll('.index-tooltip');
                linkedSources.forEach((linkedSource) => linkedSource.remove());
                return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article>${headingMarkup}${body.outerHTML}</article>`);
            }
            else if (findings) {
                const content = findings.querySelector('.flex-sections');
                if (!content) {
                    throw new Error('Findings error!');
                }
                return (dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article><${content.outerHTML}</article>`);
            }
            else {
                throw new Error('Unresolved path!');
            }
        })
            .catch((error) => utils_1.handleError(error));
    }
    fs_1.default.writeFile(`output/harpers/${publicationName} - ${volumeNumberAndDate}.html`, dom.window.document.body.innerHTML, (error) => {
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
async function harpersParser(issueUrl) {
    const headers = {
        cookie,
    };
    const options = utils_1.getOptions({ headers, issueUrl });
    // Get list of articles from the Table of Contents
    // Q1/Q2 2020 redesign is a little all over the place
    // This does not grab the artwork they print anymore
    // It's a slideshow: .issue-slideshow
    return utils_1.fetchContent(issueUrl, options).then((result) => {
        if (!result) {
            throw new Error('fetchContent error!');
        }
        const dom = new JSDOM(result);
        const readings = dom.window.document.querySelector('.issue-readings');
        const readingsLinks = readings.querySelectorAll('a.ac-title');
        const readingsHrefs = Array.from(readingsLinks).map((a) => a.href);
        const articles = dom.window.document.querySelector('.issue-articles');
        const articleLinks = articles.querySelectorAll('a:not([rel="author"])');
        const articleHrefs = Array.from(new Set(Array.from(articleLinks).map((a) => a.href)));
        const hrefs = [...readingsHrefs, ...articleHrefs];
        const header = dom.window.document.querySelector('h1');
        const volumeNumberAndDate = header.innerHTML;
        return processHrefs(hrefs, volumeNumberAndDate, options);
    });
}
exports.default = harpersParser;
