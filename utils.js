const fetch = require('node-fetch');

function fetchContent(url, options) {
  return fetch(url, options)
    .then(res => res.text())
    .catch(err => console.log('err', err));
}

function fetchContentArrayBuffer(url, options) {
  return fetch(url, options)
    .then(res =>
      res.arrayBuffer().then(ab => {
        const dataView = new DataView(ab);
        const decoder = new TextDecoder();

        return decoder.decode(dataView);
      })
    )
    .catch(err => console.log('err', err));
}

function getOptions({ headers, issueUrl }) {
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

function throwCookieError() {
  throw new Error(
    '\033[31mYOUR COOKIES HAVE EXPIRED! Please reset them to get the full article content'
  );
}

function handleError(err) {
  console.log(err.message);
  return process.exit();
}

module.exports = {
  fetchContent,
  getOptions,
  fetchContentArrayBuffer,
  throwCookieError,
  handleError,
};
