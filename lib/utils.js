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
exports.isNotNullish = exports.handleError = exports.throwCookieError = exports.getOptions = exports.fetchContentArrayBuffer = exports.fetchContent = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
function fetchContent(url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield node_fetch_1.default(url, options);
            return yield res.text();
        }
        catch (e) {
            console.error('err', e);
            return undefined;
        }
    });
}
exports.fetchContent = fetchContent;
function fetchContentArrayBuffer(url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield node_fetch_1.default(url, options);
            const ab = yield res.arrayBuffer();
            const dataView = new DataView(ab);
            const decoder = new TextDecoder();
            return decoder.decode(dataView);
        }
        catch (e) {
            console.error('err', e);
            return undefined;
        }
    });
}
exports.fetchContentArrayBuffer = fetchContentArrayBuffer;
function getOptions({ headers, issueUrl, }) {
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
    throw new Error('\x1B[31mYOUR COOKIES HAVE EXPIRED! Please reset them to get the full article content');
}
exports.throwCookieError = throwCookieError;
function handleError(err) {
    if (err instanceof Error) {
        console.error(err.message);
    }
    else {
        console.error(err);
    }
    return process.exit();
}
exports.handleError = handleError;
const isNotNullish = (val) => {
    return val !== null && val !== undefined;
};
exports.isNotNullish = isNotNullish;
