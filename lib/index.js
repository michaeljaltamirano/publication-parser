import path from 'path';
import readline from 'readline';
import nodemailer from 'nodemailer';
import createLogger from 'progress-estimator';
import harpersParser from './parsers/harpers.js';
import lrbParser from './parsers/lrb.js';
import nyrbParser from './parsers/nyrb.js';
import bookforumParser from './parsers/bookforum.js';
import ENV from './env.js';
import tlsParser from './parsers/tls.js';
import { getDirname } from './utils.js';
const { email: { recipient, sender, twoFactorPassword }, } = ENV;
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const LRB_INPUT = 1;
const NYRB_INPUT = 2;
const HARPERS_INPUT = 3;
const BOOKFORUM_INPUT = 4;
const TLS_INPUT = 5;
function getPublicationInfo(input) {
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
                exampleUrl: 'https://www.the-tls.co.uk/issues/june-26-2020/, or https://www.the-tls.co.uk/issues/current-issue-2-2/ for current issue',
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
async function send(mailOptions) {
    try {
        const info = (await transporter.sendMail(mailOptions));
        console.log(`Email sent: ${info.response}`);
    }
    catch (e) {
        console.error(e);
    }
}
async function sendEmail(mailOptions, logger) {
    await logger(send(mailOptions), 'Sending email now', { estimate: 4000 });
}
rl.question("Please enter the number associated with the publication you would like to scrape: \n  1 - LRB \n  2 - NYRB \n  3 - Harper's \n  4 - Bookforum \n  5 - The Times Literary Supplement \n\n  Answer: ", (input) => {
    const { exampleUrl, publicationParser, shorthand } = getPublicationInfo(parseInt(input, 10));
    rl.question(`\nPlease enter the full URL for the ${shorthand} issue you would like to scrape (e.g. ${exampleUrl})\n\n  Answer: `, 
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (issueUrl) => {
        try {
            const { html, epub, volumeNumberAndDate, publicationName } = await publicationParser(issueUrl);
            const logger = createLogger({
                storagePath: path.join(getDirname(), `../.progress-estimator/${shorthand}`),
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
        }
        catch (e) {
            console.error('catch');
            console.error(e);
            rl.close();
        }
    });
});
