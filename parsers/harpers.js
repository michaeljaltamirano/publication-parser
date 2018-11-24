const fs = require("fs");
const jsdom = require("jsdom");
const ENV = require("../env");
const UTILS = require("../utils");
const { JSDOM } = jsdom;
const { fetchContent, getOptions } = UTILS;

let volumeNumberAndDate;

// const cookie = "wordpress_logged_in_XXX=XXX";
const { harpersCookie: cookie } = ENV;

async function processHrefs(hrefs, options) {
  const dom = new JSDOM(`<!DOCTYPE html>`);
  dom.window.document.body.innerText = `<h1>Harper's Magazine, ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);
    await fetchContent(href, options)
      .then(result => {
        const articleDom = new JSDOM(result);

        const issueArticle = articleDom.window.document.getElementById(
          "issueArticle"
        );

        const post = issueArticle.querySelector(".post");
        const articlePost = issueArticle.querySelector(".articlePost");
        const bio = issueArticle.querySelector(".COA_roles_fix");

        return (dom.window.document.body.innerHTML = `${
          dom.window.document.body.innerHTML
        }<div class="NEW-ARTICLE">${post.innerHTML}${articlePost.innerHTML}${
          bio.innerHTML
        }</div>`);
      })
      .catch(err => console.log(err));
  }

  fs.writeFile(
    `output/harpers/Harper's Magazine - ${volumeNumberAndDate}.html`,
    dom.window.document.body.innerHTML,
    err => {
      if (err) throw err;
    }
  );

  console.log("DONE!");
}

async function harpersParser(issueUrl) {
  const headers = {
    cookie
  };

  const options = getOptions({ headers, issueUrl });

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
