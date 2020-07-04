import nodeFetch from 'node-fetch';

export function fetchContent(url: string, options: { [key: string]: any }) {
  return nodeFetch(url, options)
    .then((res) => res.text())
    .catch((err) => console.log('err', err));
}

export function fetchContentArrayBuffer(
  url: string,
  options: { [key: string]: any },
) {
  return nodeFetch(url, options)
    .then((res) =>
      res.arrayBuffer().then((ab) => {
        const dataView = new DataView(ab);
        const decoder = new TextDecoder();

        return decoder.decode(dataView);
      }),
    )
    .catch((err) => console.log('err', err));
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
    '\033[31mYOUR COOKIES HAVE EXPIRED! Please reset them to get the full article content',
  );
}

export function handleError(err: Error) {
  console.log(err.message);
  return process.exit();
}
