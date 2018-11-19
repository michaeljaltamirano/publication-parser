const fs = require("fs");
const jsdom = require("jsdom");
const ENV = require("../env");
const UTILS = require("../utils");
const { JSDOM } = jsdom;
const { fetchContent } = UTILS;

const baseUrl = "https://www.lrb.co.uk";
let volumeNumberAndDate;

// const cookie = "lrb-source=XXX; lrb-session=XXX; lrb-remember-me=XXX; lrb-segment=XXX";
const { lrbCookie: cookie } = ENV;

async function processHrefs(hrefs, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerText = `<h1>The London Review of Books, ${volumeNumberAndDate}</h1>`;

  for (const item of hrefs) {
    // Get articles
    console.log(`Fetching: ${baseUrl}${item}`);
    await fetchContent(`${baseUrl}${item}`, options)
      .then(result => {
        const articleDom = new JSDOM(`<!DOCTYPE html>`);

        articleDom.window.document.body.innerHTML = result;

        const main = articleDom.window.document.getElementById("main");
        const article = main.querySelector("div.article-body");
        const letters = main.querySelector("div.letters");

        if (article) {
          // Clean script tags
          article
            .querySelectorAll("script")
            .forEach(script => (script.innerHTML = ""));

          // Clean ads
          article
            .querySelectorAll("div.revive-midpage")
            .forEach(adDiv => (adDiv.innerHTML = ""));

          // Clean footer
          article
            .querySelectorAll("div.print-show")
            .forEach(printDiv => (printDiv.innerHTML = ""));

          return (dom.window.document.body.innerText = `${
            dom.window.document.body.innerText
          }<div class="NEW-ARTICLE">${
            article.innerHTML
          }</div><br>End Article<br>`);
        } else if (letters) {
          return (dom.window.document.body.innerText = `${
            dom.window.document.body.innerText
          }<div class="LETTERS"><h1 class="indent">Letters</h1>${
            letters.innerHTML
          }</div><br>End Letters<br>`);
        }

        // Not sure yet what other cases there are;
        return;
      })
      .catch(err => console.log(err));
  }

  fs.writeFile(
    `output/lrb/The London Review of Books - ${volumeNumberAndDate}.html`,
    dom.window.document.body.innerText,
    err => {
      if (err) throw err;
    }
  );

  console.log("DONE!");
}

async function lrbParser(issueUrl) {
  const options = {
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

  // Get list of articles
  fetchContent(issueUrl, options).then(result => {
    const firstSplit = result.split('<ul class="article-list">');
    const secondSplit = firstSplit[1].split('<script type="text/javascript">');

    const tableOfContentsDom = new JSDOM(secondSplit[0]);

    const getVolumeNumberAndDate = `<p class="issue-link">${
      result.split('<p class="issue-link">')[1].split("</p>")[0]
    }</p>`;

    const contents = issueUrl.split(baseUrl)[1];

    volumeNumberAndDate = getVolumeNumberAndDate
      .split(`<a id="current-issue-link" href="${contents}">`)[1]
      .split("</a>")[0];

    const links = tableOfContentsDom.window.document.querySelectorAll(
      "a[class='title']"
    );

    const arrayLinks = Array.from(links);

    const hrefs = arrayLinks.map(a => a.href);

    processHrefs(hrefs, options);
  });
}

module.exports = lrbParser;
