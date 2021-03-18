import nodeFetch from 'node-fetch';

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

export function handleError(err: Error | unknown) {
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
