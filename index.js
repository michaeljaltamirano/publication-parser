const extractor = require("unfluff");
const fetch = require("node-fetch");
const request = require("request");
const https = require("https");
const fs = require("fs");
const jsdom = require("jsdom");
const ENV = require("./env");
const { JSDOM } = jsdom;

const baseUrl = "https://www.lrb.co.uk";
let volumeNumberAndDate;

// const cookies = fs.readFileSync("lrbcookies.txt", "utf8");
// const cookie = "lrb-source=XXX; lrb-session=XXX; lrb-remember-me=XXX; lrb-segment=XXX";
const cookie = ENV.cookie;

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let inputUrl;

function fetchContent(url, options) {
  return fetch(url, options)
    .then(res => res.text())
    .catch(err => console.log("err", err));
}

async function processHrefs(hrefs, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerText = `<h1>The London Review of Books, ${volumeNumberAndDate}</h1>`;

  for (const item of hrefs) {
    // Get articles
    console.log(`Fetching ${baseUrl}${item}...`);
    await fetchContent(`${baseUrl}${item}`, options)
      .then(result => {
        const firstSplit = result.split('<div id="main">');

        if (firstSplit[1].indexOf('<div class="article-body indent"') > 0) {
          const header = `<hgroup>${
            firstSplit[1].split("<hgroup>")[1].split("</hgroup>")[0]
          }</hgroup>`;

          let books = "";

          // Handles tracking script embedded in article content related
          // to  book purchase URL
          if (firstSplit[1].indexOf('<ul class="books"') > 0) {
            books = `<ul class="books"${
              firstSplit[1]
                .split('<ul class="books"')[1]
                .split('<script type="text/javascript">')[0]
            }`;
          }

          if (firstSplit[1].split('<div id="article-body"')[1] == null) {
            throw new Error("YOU MUST RESET YOUR COOKIES");
          }

          let article;

          // Handle articles with dropcap and those without, like poems
          if (firstSplit[1].split('<p class="dropcap">')[1]) {
            article = `<p class="dropcap">${
              firstSplit[1]
                .split('<p class="dropcap">')[1]
                .split('<div class="print-hide">')[0]
            }`;
          } else if (
            firstSplit[1]
              .split('<div id="article-body"')[1]
              .split('<div class="print-hide">')[0]
          ) {
            article = `<div id="article-body"${
              firstSplit[1]
                .split('<div id="article-body"')[1]
                .split('<div class="print-hide">')[0]
            }`;
          }

          const articleMarkup = `${header}${books}${article}`;

          return (dom.window.document.body.innerText = `${
            dom.window.document.body.innerText
          }<div class="NEW-ARTICLE">${articleMarkup}</div><br>End article<br>`);
        } else if (firstSplit[1].indexOf('<div class="letters">') > 0) {
          const letters = `<div class="letters">${
            firstSplit[1]
              .split('<div class="letters">')[1]
              .split('<script type="text/javascript">')[0]
          }`;

          return (dom.window.document.body.innerText = `${
            dom.window.document.body.innerText
          }<div class="LETTERS"><h1 class="indent">Letters</h1>${letters}</div>`);
        }

        // Not sure yet what other cases there are;
        return;
      })
      .catch(err => console.log(err));
  }

  fs.writeFile(
    `output/The London Review of Books - ${volumeNumberAndDate}.html`,
    dom.window.document.body.innerText,
    err => {
      if (err) throw err;
    }
  );

  console.log("DONE!");
}

rl.question(
  "Please enter the full URL for the issue you would like to scrape (e.g. https://www.lrb.co.uk/v40/n20/contents): ",
  issueUrl => {
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
      const secondSplit = firstSplit[1].split(
        '<script type="text/javascript">'
      );

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

    rl.close();
  }
);
