var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const node_fetch_1 = __importDefault(require('node-fetch'));
function fetchContent(url, options) {
  return node_fetch_1
    .default(url, options)
    .then((res) => res.text())
    .catch((err) => console.log('err', err));
}
exports.fetchContent = fetchContent;
function fetchContentArrayBuffer(url, options) {
  return node_fetch_1
    .default(url, options)
    .then((res) =>
      res.arrayBuffer().then((ab) => {
        const dataView = new DataView(ab);
        const decoder = new TextDecoder();
        return decoder.decode(dataView);
      }),
    )
    .catch((err) => console.log('err', err));
}
exports.fetchContentArrayBuffer = fetchContentArrayBuffer;
function getOptions({ headers, issueUrl }) {
  return {
    credentials: 'include',
    headers,
    referrer: issueUrl,
    referrerPolicy: 'no-referrer-when-downgrade',
    body: null,
    method: 'GET',
    mode: 'cors',
  };
}
exports.getOptions = getOptions;
function throwCookieError() {
  throw new Error(
    '\033[31mYOUR COOKIES HAVE EXPIRED! Please reset them to get the full article content',
  );
}
exports.throwCookieError = throwCookieError;
function handleError(err) {
  console.log(err.message);
  return process.exit();
}
exports.handleError = handleError;
