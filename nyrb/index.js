const fetch = require("node-fetch");
const fs = require("fs");
const jsdom = require("jsdom");
const ENV = require("../env");
const UTILS = require("../utils");
const { JSDOM } = jsdom;
const { fetchContent } = UTILS;

const baseUrl = "https://www.nybooks.com";
let volumeNumberAndDate;

// const cookie = "wordpress_logged_in_XXX=michaeljaltamirano%40gmail.com%XXX";
const { nyrbCookie: cookie } = ENV;

async function processHrefs(hrefs, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerText = `<h1>The New York Review of Books, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContent(href, options)
      .then(result => {
        const articleDom = new JSDOM(result);

        const article = articleDom.window.document.querySelector(
          "article.article"
        );

        const header = article.querySelector("header");
        const body = article.querySelector("section.article_body");

        return (dom.window.document.body.innerText = `${
          dom.window.document.body.innerText
        }<div class="NEW-ARTICLE">${header.innerHTML}${body.innerHTML}</div>`);
      })
      .catch(err => console.log(err));
  }

  fs.writeFile(
    `output/The New York Review of Books - ${volumeNumberAndDate}.html`,
    dom.window.document.body.innerHTML,
    err => {
      if (err) throw err;
    }
  );

  console.log("DONE!");
}

async function nyrbParser(issueUrl) {
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

  // Get list of articles from the Table of Contents
  fetchContent(issueUrl, options).then(result => {
    const dom = new JSDOM(result);
    const tableOfContentsH2s = dom.window.document.querySelectorAll("h2");
    let hrefs = [];

    tableOfContentsH2s.forEach(h2 => {
      const a = h2.querySelector("a");
      if (a) {
        hrefs.push(a.href);
      }
    });

    volumeNumberAndDate = dom.window.document.querySelector("time").innerHTML;

    processHrefs(hrefs, options);
  });
}

module.exports = nyrbParser;
