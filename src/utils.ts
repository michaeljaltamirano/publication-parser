import nodeFetch from 'node-fetch';

export async function fetchContent(
  url: string,
  options: Record<string, unknown>,
): Promise<string | undefined> {
  return nodeFetch(url, options)
    .then(async (res) => res.text())
    .catch((err) => {
      console.error('err', err);
      return undefined;
    });
}

export async function fetchContentArrayBuffer(
  url: string,
  options: Record<string, unknown>,
) {
  return nodeFetch(url, options)
    .then(async (res) =>
      res.arrayBuffer().then((ab) => {
        const dataView = new DataView(ab);
        const decoder = new TextDecoder();

        return decoder.decode(dataView);
      }),
    )
    .catch((err) => {
      console.error('err', err);
      return undefined;
    });
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

export function handleError(err: Error) {
  console.error(err.message);
  return process.exit();
}

export const isNotNullish = <T>(val: T | null | undefined): val is T => {
  return val !== null && val !== undefined;
};
