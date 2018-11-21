const fs = require("fs");
const jsdom = require("jsdom");
const ENV = require("../env");
const UTILS = require("../utils");
const { JSDOM } = jsdom;
const { fetchContent, getOptions } = UTILS;

const baseUrl = "https://harpers.org";
let volumeNumberAndDate;

// const cookie = "";
const { harpersCookie: cookie } = ENV;

let inputUrl;

async function harpersParser(issueUrl) {
  const options = getOptions(cookie, issueUrl);

  // Get list of articles from the Table of Contents
  fetchContent(issueUrl, options).then(result => {
    const dom = new JSDOM(result);
    const issueContent = dom.window.document.getElementById("issueContent");
    const issues = issueContent.querySelectorAll(".Issue");

    let hrefs = [];

    issues.forEach(article => {
      const h2s = article.querySelectorAll("h2");

      h2s.forEach(h2 => hrefs.push(h2.querySelector("a").href));
    });

    volumeNumberAndDate = dom.window.document.querySelector("h1").innerHTML;

    processHrefs(hrefs, options);
  });
}

module.exports = harpersParser;
