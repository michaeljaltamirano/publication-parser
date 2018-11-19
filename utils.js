const fetch = require("node-fetch");

function fetchContent(url, options) {
  return fetch(url, options)
    .then(res => res.text())
    .catch(err => console.log("err", err));
}

module.exports = {
  fetchContent
};
