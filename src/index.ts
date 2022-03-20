import path from 'path';
import readline from 'readline';
import nodemailer from 'nodemailer';
import createLogger from 'progress-estimator';
import type SESTransport from 'nodemailer/lib/ses-transport';

import harpersParser from './parsers/harpers';
import lrbParser from './parsers/lrb';
import nyrbParser from './parsers/nyrb';
import bookforumParser from './parsers/bookforum';
import ENV from './env';
import tlsParser from './parsers/tls';

const {
  email: { recipient, sender, twoFactorPassword },
} = ENV;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

interface GetPublicationInfoReturnType {
  exampleUrl: string;
  publicationParser: (issueUrl: string) => Promise<{
    epub: Buffer;
    html: string;
    publicationName: string;
    volumeNumberAndDate: string;
  }>;
  shorthand: string;
}

const LRB_INPUT = 1;
const NYRB_INPUT = 2;
const HARPERS_INPUT = 3;
const BOOKFORUM_INPUT = 4;
const TLS_INPUT = 5;

function getPublicationInfo(input: number): GetPublicationInfoReturnType {
  switch (input) {
    case LRB_INPUT:
      return {
        exampleUrl: 'https://www.lrb.co.uk/the-paper/v42/n09',
        publicationParser: lrbParser,
        shorthand: 'lrb',
      };
    case NYRB_INPUT:
      return {
        exampleUrl: 'https://www.nybooks.com/issues/2020/05/28/',
        publicationParser: nyrbParser,
        shorthand: 'nyrb',
      };
    case HARPERS_INPUT:
      return {
        exampleUrl: 'https://harpers.org/archive/2020/05/',
        publicationParser: harpersParser,
        shorthand: 'harpers',
      };
    case BOOKFORUM_INPUT:
      return {
        exampleUrl: 'https://www.bookforum.com/print/2701',
        publicationParser: bookforumParser,
        shorthand: 'bookforum',
      };
    case TLS_INPUT:
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

interface MailOptions {
  attachments: {
    content: string | Buffer;
    contentType?: string;
    filename: string;
  }[];
  from: string;
  subject: string;
  to: string;
}

async function send(mailOptions: MailOptions) {
  try {
    const info = (await transporter.sendMail(
      mailOptions,
    )) as SESTransport.SentMessageInfo;

    console.log(`Email sent: ${info.response}`);
  } catch (e: unknown) {
    console.error(e);
  }
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
      parseInt(input, 10),
    );

    rl.question(
      `\nPlease enter the full URL for the ${shorthand} issue you would like to scrape (e.g. ${exampleUrl})\n\n  Answer: `,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (issueUrl) => {
        try {
          const { html, epub, volumeNumberAndDate, publicationName } =
            await publicationParser(issueUrl);

          const logger = createLogger({
            storagePath: path.join(
              __dirname,
              `../.progress-estimator/${shorthand}`,
            ),
          });

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
              {
                filename: `${publicationName} - ${volumeNumberAndDate}.epub`,
                content: epub,
              },
            ],
          };

          await sendEmail(mailOptions, logger);

          rl.close();
        } catch (e: unknown) {
          console.error('catch');
          console.error(e);

          rl.close();
        }
      },
    );
  },
);
