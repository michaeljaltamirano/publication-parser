const fs = require("fs");
const readline = require("readline");
const harpersParser = require("./parsers/harpers");
const lrbParser = require("./parsers/lrb");
const nyrbParser = require("./parsers/nyrb");
const bookforumParser = require("./parsers/bookforum");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getPublicationParser(publicationName) {
  switch (publicationName) {
    case 1:
      return lrbParser;
    case 2:
      return nyrbParser;
    case 3:
      return harpersParser;
    case 4:
      return bookforumParser;
    default:
      throw new Error("Publication not found");
  }
}

function getExampleUrl(publicationName) {
  switch (publicationName) {
    case 1:
      return "https://www.lrb.co.uk/v40/n20/contents";
    case 2:
      return "https://www.nybooks.com/issues/2018/12/06/";
    case 3:
      return "https://harpers.org/archive/2018/12/";
    case 4:
      return "https://bookforum.com/inprint/025_03";
    default:
      throw new Error("Publication not found");
  }
}

rl.question(
  "Please enter the number associated with the publication you would like to scrape: \n  1 - LRB \n  2 - NYRB \n  3 - Harper's \n  4 - Bookforum \n\n  Answer: ",
  number => {
    const exampleUrl = getExampleUrl(parseInt(number));

    rl.question(
      `\nPlease enter the full URL for the LRB or NYRB issue you would like to scrape (e.g. ${exampleUrl})\n\n  Answer: `,
      issueUrl => {
        const publicationParser = getPublicationParser(parseInt(number));

        publicationParser(issueUrl);

        rl.close();
      }
    );
  }
);
