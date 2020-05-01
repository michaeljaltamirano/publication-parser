var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const path_1 = __importDefault(require('path'));
const readline_1 = __importDefault(require('readline'));
const nodemailer_1 = __importDefault(require('nodemailer'));
const harpers_1 = __importDefault(require('./parsers/harpers'));
const lrb_1 = __importDefault(require('./parsers/lrb'));
const nyrb_1 = __importDefault(require('./parsers/nyrb'));
const bookforum_1 = __importDefault(require('./parsers/bookforum'));
const progress_estimator_1 = __importDefault(require('progress-estimator'));
const env_1 = __importDefault(require('./env'));
const {
  email: { recipient, sender, twoFactorPassword },
} = env_1.default;
const rl = readline_1.default.createInterface({
  input: process.stdin,
  output: process.stdout,
});
function getPublicationInfo(input) {
  switch (input) {
    case 1:
      return {
        exampleUrl: 'https://www.lrb.co.uk/the-paper/v42/n09',
        publicationParser: lrb_1.default,
        shorthand: 'lrb',
      };
    case 2:
      return {
        exampleUrl: 'https://www.nybooks.com/issues/2020/05/28/',
        publicationParser: nyrb_1.default,
        shorthand: 'nyrb',
      };
    case 3:
      return {
        exampleUrl: 'https://harpers.org/archive/2020/05/',
        publicationParser: harpers_1.default,
        shorthand: 'harpers',
      };
    case 4:
      return {
        exampleUrl: 'https://www.bookforum.com/print/2701',
        publicationParser: bookforum_1.default,
        shorthand: 'bookforum',
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
    const emailSentMsg = yield transporter
      .sendMail(mailOptions)
      .then((info) => console.log('Email sent: ' + info.response))
      .catch((error) => console.log(error));
    console.log(emailSentMsg);
  });
}
function sendEmail(mailOptions, logger) {
  return __awaiter(this, void 0, void 0, function* () {
    yield logger(send(mailOptions), 'Sending email now', 4000);
  });
}
rl.question(
  "Please enter the number associated with the publication you would like to scrape: \n  1 - LRB \n  2 - NYRB \n  3 - Harper's \n  4 - Bookforum \n\n  Answer: ",
  (input) => {
    const { exampleUrl, publicationParser, shorthand } = getPublicationInfo(
      parseInt(input),
    );
    rl.question(
      `\nPlease enter the full URL for the LRB or NYRB issue you would like to scrape (e.g. ${exampleUrl})\n\n  Answer: `,
      (issueUrl) => {
        publicationParser(issueUrl).then((res) => {
          const logger = progress_estimator_1.default({
            storagePath: path_1.default.join(
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
