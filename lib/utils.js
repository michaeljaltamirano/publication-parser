import ebookConverter from 'node-ebook-converter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
export async function lazyImportNodeFetch() {
    const nodeFetch = await import('node-fetch');
    return nodeFetch.default;
}
export async function fetchContent(url, options) {
    try {
        const nodeFetch = await lazyImportNodeFetch();
        const res = await nodeFetch(url, options);
        return await res.text();
    }
    catch (e) {
        console.error('err', e);
        return undefined;
    }
}
export async function fetchContentArrayBuffer(url, options) {
    try {
        const nodeFetch = await lazyImportNodeFetch();
        const res = await nodeFetch(url, options);
        const ab = await res.arrayBuffer();
        const dataView = new DataView(ab);
        const decoder = new TextDecoder();
        return decoder.decode(dataView);
    }
    catch (e) {
        console.error('err', e);
        return undefined;
    }
}
export function getOptions({ headers, issueUrl, }) {
    return {
        credentials: 'include',
        headers,
        referrer: issueUrl,
        referrerPolicy: 'no-referrer-when-downgrade',
        body: null,
        method: 'GET',
        mode: 'cors',
    };
}
export function throwCookieError() {
    throw new Error('\x1B[31mYOUR COOKIES HAVE EXPIRED! Please reset them to get the full article content');
}
export function handleError(err) {
    if (err instanceof Error) {
        console.error(err.message);
    }
    else {
        console.error(err);
    }
    return process.exit();
}
export const isNotNullish = (val) => {
    return val !== null && val !== undefined;
};
async function convertHtmlToEpub({ publicationName, shorthand, volumeNumberAndDate, }) {
    await new Promise((resolve, reject) => {
        const pathWithoutExtension = `output/${shorthand}/${publicationName} - ${volumeNumberAndDate}`;
        const input = path.resolve(`${pathWithoutExtension}.html`);
        const output = path.resolve(`${pathWithoutExtension}.epub`);
        console.log('input', input);
        console.log('what is output', output);
        ebookConverter
            .convert({
            input,
            output,
        })
            .then((response) => {
            console.log(response);
            resolve(response);
            return response;
        })
            .catch((error) => {
            console.log('html catch');
            console.error(error);
            reject(error);
        });
    });
}
export function getDirname() {
    return path.dirname(fileURLToPath(import.meta.url));
}
export async function getEpub({ publicationName, shorthand, volumeNumberAndDate, }) {
    await convertHtmlToEpub({
        publicationName,
        shorthand,
        volumeNumberAndDate,
    });
    let epub = Buffer.from('');
    const epubPath = path.resolve(getDirname(), '..', `output/${shorthand}/${publicationName} - ${volumeNumberAndDate}.epub`);
    console.log('epubPath', epubPath);
    console.log('trying different setups');
    console.log(path.resolve(getDirname(), '..', `output/${shorthand}/${publicationName} - ${volumeNumberAndDate}.epub`));
    console.log(path.resolve(getDirname(), `output/${shorthand}/${publicationName} - ${volumeNumberAndDate}.epub`));
    /**
     * Read epub file
     */
    try {
        epub = fs.readFileSync(epubPath);
    }
    catch (e) {
        console.error(e);
    }
    return epub;
}
export const writeHtmlFile = ({ html, publicationName, shorthand, volumeNumberAndDate, }) => {
    const htmlPath = path.join(getDirname(), '..', `output/${shorthand}/${publicationName} - ${volumeNumberAndDate}.html`);
    console.log('what is htmlPath', htmlPath);
    try {
        fs.writeFileSync(htmlPath, html);
    }
    catch (e) {
        console.log('in catch', e);
        console.error(e);
    }
};
export const clearNewlinesAndFormatting = (str) => str.replace(/(\r\n|\n|\r)/gm, '').trim();
