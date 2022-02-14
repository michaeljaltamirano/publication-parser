"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const progress_estimator_1 = __importDefault(require("progress-estimator"));
const harpers_1 = __importDefault(require("./parsers/harpers"));
const lrb_1 = __importDefault(require("./parsers/lrb"));
const nyrb_1 = __importDefault(require("./parsers/nyrb"));
const bookforum_1 = __importDefault(require("./parsers/bookforum"));
const env_1 = __importDefault(require("./env"));
const tls_1 = __importDefault(require("./parsers/tls"));
const { email: { recipient, sender, twoFactorPassword }, } = env_1.default;
const rl = readline_1.default.createInterface({
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
                publicationParser: lrb_1.default,
                shorthand: 'lrb',
            };
        case NYRB_INPUT:
            return {
                exampleUrl: 'https://www.nybooks.com/issues/2020/05/28/',
                publicationParser: nyrb_1.default,
                shorthand: 'nyrb',
            };
        case HARPERS_INPUT:
            return {
                exampleUrl: 'https://harpers.org/archive/2020/05/',
                publicationParser: harpers_1.default,
                shorthand: 'harpers',
            };
        case BOOKFORUM_INPUT:
            return {
                exampleUrl: 'https://www.bookforum.com/print/2701',
                publicationParser: bookforum_1.default,
                shorthand: 'bookforum',
            };
        case TLS_INPUT:
            return {
                exampleUrl: 'https://www.the-tls.co.uk/issues/june-26-2020/, or https://www.the-tls.co.uk/issues/current-issue-2-2/ for current issue',
                publicationParser: tls_1.default,
                shorthand: 'The Times Literary Supplement',
            };
        default:
            throw new Error('Publication not found');
    }
}
// Currently support only Gmail
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: sender,
        pass: twoFactorPassword,
    },
});
function send(mailOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const info = (yield transporter.sendMail(mailOptions));
            console.log(`Email sent: ${info.response}`);
        }
        catch (e) {
            console.error(e);
        }
    });
}
function sendEmail(mailOptions, logger) {
    return __awaiter(this, void 0, void 0, function* () {
        yield logger(send(mailOptions), 'Sending email now', { estimate: 4000 });
    });
}
rl.question("Please enter the number associated with the publication you would like to scrape: \n  1 - LRB \n  2 - NYRB \n  3 - Harper's \n  4 - Bookforum \n  5 - The Times Literary Supplement \n\n  Answer: ", (input) => {
    const { exampleUrl, publicationParser, shorthand } = getPublicationInfo(parseInt(input, 10));
    rl.question(`\nPlease enter the full URL for the ${shorthand} issue you would like to scrape (e.g. ${exampleUrl})\n\n  Answer: `, 
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    (issueUrl) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { html, epub, volumeNumberAndDate, publicationName, } = yield publicationParser(issueUrl);
            const logger = progress_estimator_1.default({
                storagePath: path_1.default.join(__dirname, `../.progress-estimator/${shorthand}`),
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
            yield sendEmail(mailOptions, logger);
            rl.close();
        }
        catch (e) {
            console.error('catch');
            console.error(e);
            rl.close();
        }
    }));
});
