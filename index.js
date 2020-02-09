const fs = require('fs');
const readline = require('readline');
const nodemailer = require('nodemailer');
const harpersParser = require('./parsers/harpers');
const lrbParser = require('./parsers/lrb');
const nyrbParser = require('./parsers/nyrb');
const bookforumParser = require('./parsers/bookforum');
const createLogger = require('progress-estimator');
const path = require('path');
const ENV = require('./env');
const {
  email: { recipient, sender, twoFactorPassword },
} = ENV;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function getPublicationInfo(input) {
  switch (input) {
    case 1:
      return {
        exampleUrl: 'https://www.lrb.co.uk/v40/n20/contents',
        publicationParser: lrbParser,
        shorthand: 'lrb',
      };
    case 2:
      return {
        exampleUrl: 'https://www.nybooks.com/issues/2018/12/06/',
        publicationParser: nyrbParser,
        shorthand: 'nyrb',
      };
    case 3:
      return {
        exampleUrl: 'https://harpers.org/archive/2018/12/',
        publicationParser: harpersParser,
        shorthand: 'harpers',
      };
    case 4:
      return {
        exampleUrl: 'https://bookforum.com/inprint/025_03',
        publicationParser: bookforumParser,
        shorthand: 'bookforum',
      };
    default:
      throw new Error('Publication not found');
  }
}

// Currently support only Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: sender,
    pass: twoFactorPassword,
  },
});

async function send(mailOptions) {
  const emailSentMsg = await transporter
    .sendMail(mailOptions)
    .then(info => console.log('Email sent: ' + info.response))
    .catch(error => console.log(error));

  console.log(emailSentMsg);
}

async function sendEmail(mailOptions, logger) {
  await logger(send(mailOptions), 'Sending email now', 4000);
}

rl.question(
  "Please enter the number associated with the publication you would like to scrape: \n  1 - LRB \n  2 - NYRB \n  3 - Harper's \n  4 - Bookforum \n\n  Answer: ",
  input => {
    const { exampleUrl, publicationParser, shorthand } = getPublicationInfo(
      parseInt(input)
    );

    rl.question(
      `\nPlease enter the full URL for the LRB or NYRB issue you would like to scrape (e.g. ${exampleUrl})\n\n  Answer: `,
      issueUrl => {
        publicationParser(issueUrl).then(res => {
          const logger = createLogger({
            storagePath: path.join(
              __dirname,
              `.progress-estimator/${shorthand}`
            ),
          });

          // PDFs currently only present in Harper's output
          const { html, volumeNumberAndDate, publicationName, pdfs = [] } = res;

          const mailOptions = {
            from: sender,
            to: recipient,
            subject: `${publicationName} - ${volumeNumberAndDate}`,
            attachments: [
              {
                filename: `${publicationName} - ${volumeNumberAndDate}.html`,
                content: html,
                contentType: 'text/html',
              },
            ].concat(pdfs),
          };

          sendEmail(mailOptions, logger);
        });

        rl.close();
      }
    );
  }
);
