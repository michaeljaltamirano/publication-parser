import nodeFetch from 'node-fetch';
import ebookConverter from 'node-ebook-converter';
import fs from 'fs';
import path from 'path';

export async function fetchContent(
  url: string,
  options: Record<string, unknown>,
): Promise<string | undefined> {
  try {
    const res = await nodeFetch(url, options);
    return await res.text();
  } catch (e: unknown) {
    console.error('err', e);
    return undefined;
  }
}

export async function fetchContentArrayBuffer(
  url: string,
  options: Record<string, unknown>,
) {
  try {
    const res = await nodeFetch(url, options);
    const ab = await res.arrayBuffer();
    const dataView = new DataView(ab);
    const decoder = new TextDecoder();

    return decoder.decode(dataView);
  } catch (e: unknown) {
    console.error('err', e);
    return undefined;
  }
}

export function getOptions({
  headers,
  issueUrl,
}: {
  headers: {
    cookie: string;
  };
  issueUrl: string;
}) {
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
  throw new Error(
    '\x1B[31mYOUR COOKIES HAVE EXPIRED! Please reset them to get the full article content',
  );
}

export function handleError(err: unknown) {
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }

  return process.exit();
}

export const isNotNullish = <T>(val: T | null | undefined): val is T => {
  return val !== null && val !== undefined;
};

interface EpubArgs {
  publicationName: string;
  shorthand: string;
  volumeNumberAndDate: string;
}

interface EpubArgs {
  publicationName: string;
  shorthand: string;
  volumeNumberAndDate: string;
}

async function convertHtmlToEpub({
  publicationName,
  shorthand,
  volumeNumberAndDate,
}: EpubArgs) {
  await new Promise((resolve, reject) => {
    ebookConverter
      .convert({
        input: `../output/${shorthand}/${publicationName} - ${volumeNumberAndDate}.html`,
        output: `../output/${shorthand}/${publicationName} - ${volumeNumberAndDate}.epub`,
      })
      .then((response) => {
        console.log(response);
        resolve(response);
        return response;
      })
      .catch((error) => {
        console.error(error);
        reject(error);
      });
  });
}

export async function getEpub({
  publicationName,
  shorthand,
  volumeNumberAndDate,
}: EpubArgs) {
  await convertHtmlToEpub({
    publicationName,
    shorthand,
    volumeNumberAndDate,
  });

  let epub = Buffer.from('');

  const epubPath = path.resolve(
    __dirname,
    '..',
    `output/${shorthand}/${publicationName} - ${volumeNumberAndDate}.epub`,
  );

  /**
   * Read epub file
   */
  try {
    epub = fs.readFileSync(epubPath);
  } catch (e: unknown) {
    console.error(e);
  }

  return epub;
}

interface WriteHtmlFileArgs {
  html: string;
  publicationName: string;
  shorthand: string;
  volumeNumberAndDate: string;
}

export const writeHtmlFile = ({
  html,
  publicationName,
  shorthand,
  volumeNumberAndDate,
}: WriteHtmlFileArgs) => {
  const htmlPath = path.join(
    __dirname,
    '..',
    `output/${shorthand}/${publicationName} - ${volumeNumberAndDate}.html`,
  );

  try {
    fs.writeFileSync(htmlPath, html);
  } catch (e: unknown) {
    console.error(e);
  }
};

export const clearNewlinesAndFormatting = (str: string) =>
  str.replace(/(\r\n|\n|\r)/gm, '').trim();
