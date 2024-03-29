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
const publicationName = "Harper's Magazine";
// const cookie = "wordpress_logged_in_XXX=XXX";
const { harpersCookie: cookie } = env_1.default;
const getFeatureArticleContent = (articleLayoutFeature) => {
    var _a, _b, _c;
    const newArticleLayoutFeature = articleLayoutFeature.cloneNode(true);
    const featureLayoutHeader = (_b = (_a = newArticleLayoutFeature.querySelector('.title-header.desktop')) === null || _a === void 0 ? void 0 : _a.outerHTML) !== null && _b !== void 0 ? _b : '';
    const picture = newArticleLayoutFeature.querySelector('.article-hero-img');
    const pictureMarkup = (_c = picture === null || picture === void 0 ? void 0 : picture.outerHTML) !== null && _c !== void 0 ? _c : '';
    const flexSections = newArticleLayoutFeature.querySelector('.flex-sections');
    if (flexSections) {
        // Remove sidebar ad + other content
        const sidebarsMd = flexSections.querySelectorAll('.col-md-4');
        sidebarsMd.forEach((section) => {
            section.remove();
        });
        const sidebarsLg = flexSections.querySelectorAll('.col-lg-4');
        sidebarsLg.forEach((section) => {
            section.remove();
        });
        const afterPostContent = flexSections.querySelectorAll('.after-post-content');
        afterPostContent.forEach((section) => {
            section.remove();
        });
        const controls = flexSections.querySelectorAll('.header-meta.header-controls');
        controls.forEach((section) => {
            section.remove();
        });
        const content = Array.from(flexSections.children).reduce((article, contentBlock) => {
            if (Array.from(contentBlock.classList).includes('after-post-content')) {
                return article;
            }
            let newString = article;
            if (contentBlock.outerHTML) {
                newString += contentBlock.outerHTML;
            }
            return newString;
        }, '');
        return { featureLayoutHeader, pictureMarkup, content };
    }
    throw new Error('no flexSections found');
};
const getSimpleArticleContent = (articleLayoutSimple) => {
    var _a;
    const newArticleLayoutSimple = articleLayoutSimple.cloneNode(true);
    const simpleLayoutHeader = newArticleLayoutSimple.querySelector('.article-header');
    const headerMeta = simpleLayoutHeader === null || simpleLayoutHeader === void 0 ? void 0 : simpleLayoutHeader.querySelector('.header-meta');
    // Remove share article text
    headerMeta === null || headerMeta === void 0 ? void 0 : headerMeta.remove();
    const content = newArticleLayoutSimple.querySelectorAll('.wysiwyg-content');
    // Remove email signup block
    content.forEach((contentBlock) => {
        const afterPostContent = contentBlock.querySelectorAll('.after-post-content');
        afterPostContent.forEach((section) => {
            section.remove();
        });
    });
    const combinedContent = Array.from(content).reduce((acc, arrContent) => {
        const additional = Array.from(arrContent.children).reduce((article, contentBlock) => {
            return article + contentBlock.outerHTML;
        }, '');
        return acc + additional;
    }, '');
    return {
        simpleLayoutHeader: (_a = simpleLayoutHeader === null || simpleLayoutHeader === void 0 ? void 0 : simpleLayoutHeader.outerHTML) !== null && _a !== void 0 ? _a : '',
        combinedContent,
    };
};
const getHarpersIndex = (harpersIndex) => {
    var _a;
    const heading = harpersIndex.querySelector('h1');
    const headingMarkup = (_a = heading === null || heading === void 0 ? void 0 : heading.outerHTML) !== null && _a !== void 0 ? _a : '';
    const body = harpersIndex.querySelector('.page-container');
    if (!body) {
        throw new Error("Harper's Index error!");
    }
    const linkedSources = body.querySelectorAll('.index-tooltip');
    linkedSources.forEach((linkedSource) => {
        linkedSource.remove();
    });
    return { headingMarkup, body };
};
const processContent = (articleDom, dom) => {
    const articleLayoutFeature = articleDom.window.document.querySelector('.article-layout-featured');
    if (articleLayoutFeature) {
        const { featureLayoutHeader, pictureMarkup, content, } = getFeatureArticleContent(articleLayoutFeature);
        dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article>${featureLayoutHeader}${pictureMarkup}${content}</article>`;
        return undefined;
    }
    const articleLayoutSimple = articleDom.window.document.querySelector('.article-layout-simple');
    if (articleLayoutSimple) {
        const { simpleLayoutHeader, combinedContent } = getSimpleArticleContent(articleLayoutSimple);
        dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article>${simpleLayoutHeader}${combinedContent}</article>`;
        return undefined;
    }
    const harpersIndex = articleDom.window.document.querySelector('.post-type-archive-index');
    if (harpersIndex) {
        const { headingMarkup, body } = getHarpersIndex(harpersIndex);
        dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article>${headingMarkup}${body.outerHTML}</article>`;
        return undefined;
    }
    const findings = articleDom.window.document.querySelector('.article-layout-finding');
    if (findings) {
        const content = findings.querySelector('.flex-sections');
        if (!content) {
            throw new Error('Findings error!');
        }
        dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article><${content.outerHTML}</article>`;
        return undefined;
    }
    throw new Error('Unresolved path!');
};
function processHrefs(hrefs, volumeNumberAndDate, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const dom = new JSDOM('<!DOCTYPE html>');
        dom.window.document.body.innerHTML = `<h1>${publicationName} ${volumeNumberAndDate}</h1>`;
        for (const href of hrefs) {
            // Get articles
            console.log(`Fetching: ${href}`);
            try {
                const result = yield utils_1.fetchContent(href, options);
                if (!utils_1.isNotNullish(result)) {
                    throw new Error('fetchContent error!');
                }
                const articleDom = new JSDOM(result);
                const paywall = articleDom.window.document.getElementById('leaky_paywall_message');
                if (paywall)
                    utils_1.throwCookieError();
                processContent(articleDom, dom);
            }
            catch (e) {
                utils_1.handleError(e);
            }
        }
        try {
            fs_1.default.writeFileSync(`output/harpers/${publicationName} - ${volumeNumberAndDate}.html`, dom.window.document.body.innerHTML);
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
function harpersParser(issueUrl) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            cookie,
        };
        const options = utils_1.getOptions({ headers, issueUrl });
        // Get list of articles from the Table of Contents
        // Q1/Q2 2020 redesign is a little all over the place
        // This does not grab the artwork they print anymore
        // It's a slideshow: .issue-slideshow
        const result = yield utils_1.fetchContent(issueUrl, options);
        if (!utils_1.isNotNullish(result)) {
            throw new Error('fetchContent error!');
        }
        const dom = new JSDOM(result);
        const readings = dom.window.document.querySelector('.issue-readings');
        const readingsLinks = (_a = readings === null || readings === void 0 ? void 0 : readings.querySelectorAll('a.ac-title')) !== null && _a !== void 0 ? _a : [];
        const readingsHrefs = Array.from(readingsLinks).map((a) => a.href);
        const articles = dom.window.document.querySelector('.issue-articles');
        const articleLinks = (_b = articles === null || articles === void 0 ? void 0 : articles.querySelectorAll('a:not([rel="author"])')) !== null && _b !== void 0 ? _b : [];
        const articleHrefs = Array.from(new Set(Array.from(articleLinks).map((a) => a.href)));
        const hrefs = [...readingsHrefs, ...articleHrefs];
        const header = dom.window.document.querySelector('h1');
        const volumeNumberAndDate = (_c = header === null || header === void 0 ? void 0 : header.innerHTML) !== null && _c !== void 0 ? _c : 'UNKNOWN';
        return processHrefs(hrefs, volumeNumberAndDate, options);
    });
}
exports.default = harpersParser;
