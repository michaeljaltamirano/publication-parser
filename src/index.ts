import path from 'path';
import readline from 'readline';
import nodemailer from 'nodemailer';
import harpersParser from './parsers/harpers';
import lrbParser from './parsers/lrb';
import nyrbParser from './parsers/nyrb';
import bookforumParser from './parsers/bookforum';
import createLogger from 'progress-estimator';
import ENV from './env';
import tlsParser from './parsers/tls';

const {
  email: { recipient, sender, twoFactorPassword },
} = ENV;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

type GetPublicationInfoReturnType = {
  exampleUrl: string;
  publicationParser: (
    issueUrl: string,
  ) => Promise<{
    html: string;
    volumeNumberAndDate: unknown;
    publicationName: string;
  }>;
  shorthand: string;
};

function getPublicationInfo(input: number): GetPublicationInfoReturnType {
  switch (input) {
    case 1:
      return {
        exampleUrl: 'https://www.lrb.co.uk/the-paper/v42/n09',
        publicationParser: lrbParser,
        shorthand: 'lrb',
      };
    case 2:
      return {
        exampleUrl: 'https://www.nybooks.com/issues/2020/05/28/',
        publicationParser: nyrbParser,
        shorthand: 'nyrb',
      };
    case 3:
      return {
        exampleUrl: 'https://harpers.org/archive/2020/05/',
        publicationParser: harpersParser,
        shorthand: 'harpers',
      };
    case 4:
      return {
        exampleUrl: 'https://www.bookforum.com/print/2701',
        publicationParser: bookforumParser,
        shorthand: 'bookforum',
      };
    case 5:
      return {
        exampleUrl:
          'https://www.the-tls.co.uk/issues/june-26-2020/, or https://www.the-tls.co.uk/issues/current-issue-2-2/ for current issue',
        publicationParser: tlsParser,
        shorthand: 'The Times Literary Supplement',
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

type MailOptions = {
  from: string;
  to: string;
  subject: string;
  attachments: {
    filename: string;
    content: string;
    contentType: string;
  }[];
};

async function send(mailOptions: MailOptions) {
  const emailSentMsg = await transporter
    .sendMail(mailOptions)
    .then((info) => console.log('Email sent: ' + info.response))
    .catch((error) => console.log(error));

  console.log(emailSentMsg);
}

async function sendEmail(
  mailOptions: MailOptions,
  logger: createLogger.ProgressEstimator,
) {
  await logger(send(mailOptions), 'Sending email now', { estimate: 4000 });
}

rl.question(
  "Please enter the number associated with the publication you would like to scrape: \n  1 - LRB \n  2 - NYRB \n  3 - Harper's \n  4 - Bookforum \n  5 - The Times Literary Supplement \n\n  Answer: ",
  (input) => {
    const { exampleUrl, publicationParser, shorthand } = getPublicationInfo(
      parseInt(input),
    );

    rl.question(
      `\nPlease enter the full URL for the LRB or NYRB issue you would like to scrape (e.g. ${exampleUrl})\n\n  Answer: `,
      (issueUrl) => {
        publicationParser(issueUrl).then((res) => {
          const logger = createLogger({
            storagePath: path.join(
              __dirname,
              `../.progress-estimator/${shorthand}`,
            ),
          });

          const { html, volumeNumberAndDate, publicationName } = res;

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
            ],
          };

          sendEmail(mailOptions, logger);
        });

        rl.close();
      },
    );
  },
);
