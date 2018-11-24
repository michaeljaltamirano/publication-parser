const fetch = require("node-fetch");

function fetchContent(url, options) {
  return fetch(url, options)
    .then(res => res.text())
    .catch(err => console.log("err", err));
}

function fetchContentArrayBuffer(url, options) {
  return fetch(url, options)
    .then(res => {
      const contentType = options.headers["Content-Type"];
      const charset = contentType.substring(
        contentType.indexOf("charset=") + 8
      );

      return res.arrayBuffer().then(ab => {
        const dataView = new DataView(ab);
        const decoder = new TextDecoder(charset);

        return decoder.decode(dataView);
      });
    })
    .catch(err => console.log("err", err));
}

function getOptions({ headers, issueUrl }) {
  return {
    credentials: "include",
    headers,
    referrer: issueUrl,
    referrerPolicy: "no-referrer-when-downgrade",
    body: null,
    method: "GET",
    mode: "cors"
  };
}

module.exports = {
  fetchContent,
  getOptions,
  fetchContentArrayBuffer
};
