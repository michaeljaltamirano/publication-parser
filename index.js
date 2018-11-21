const fs = require("fs");
const readline = require("readline");
const harpersParser = require("./harpers");
const lrbParser = require("./lrb");
const nyrbParser = require("./nyrb");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getPublicationParser(publicationName) {
  switch (publicationName) {
    case "lrb":
      return lrbParser;
    case "nyrb":
      return nyrbParser;
    case "harper's":
    case "harpers":
      return harpersParser;
    default:
      throw new Error("Publication not found");
  }
}

function getExampleUrl(publicationName) {
  switch (publicationName) {
    case "lrb":
      return "https://www.lrb.co.uk/v40/n20/contents";
    case "nyrb":
      return "https://www.nybooks.com/issues/2018/12/06/";
    case "harper's":
    case "harpers":
      return "https://harpers.org/archive/2018/12/";
    default:
      throw new Error("Publication not found");
  }
}

rl.question(
  "Please enter the Publication you would like to scrape (e.g. LRB/NYRB/Harper's): ",
  pubName => {
    const publicationName = pubName.toLowerCase();
    const exampleUrl = getExampleUrl(publicationName);

    rl.question(
      `Please enter the full URL for the LRB or NYRB issue you would like to scrape (e.g. ${exampleUrl}): `,
      issueUrl => {
        const publicationParser = getPublicationParser(publicationName);

        publicationParser(issueUrl);

        rl.close();
      }
    );
  }
);
