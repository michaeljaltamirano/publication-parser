const fetch = require("node-fetch");

function fetchContent(url, options) {
  return fetch(url, options)
    .then(res => res.text())
    .catch(err => console.log("err", err));
}

function getOptions(cookie, issueUrl) {
  return {
    credentials: "include",
    headers: {
      cookie
    },
    referrer: issueUrl,
    referrerPolicy: "no-referrer-when-downgrade",
    body: null,
    method: "GET",
    mode: "cors"
  };
}

module.exports = {
  fetchContent,
  getOptions
};
