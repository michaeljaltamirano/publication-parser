import jsdom from 'jsdom';
import ENV from '../env.js';
import {
  fetchContent,
  getOptions,
  throwCookieError,
  handleError,
  isNotNullish,
  writeHtmlFile,
  getEpub,
  clearNewlinesAndFormatting,
} from '../utils.js';

const { JSDOM } = jsdom;

const publicationName = "Harper's Magazine";
// const cookie = "wordpress_logged_in_XXX=XXX";
const { harpersCookie: cookie } = ENV;

const getFeatureArticleContent = (articleLayoutFeature: Element) => {
  const newArticleLayoutFeature = articleLayoutFeature.cloneNode(
    true,
  ) as Element;

  const featureLayoutHeader =
    newArticleLayoutFeature.querySelector('.title-header.desktop')?.outerHTML ??
    '';

  const picture = newArticleLayoutFeature.querySelector('.article-hero-img');
  const pictureMarkup = picture?.outerHTML ?? '';

  const flexSections = newArticleLayoutFeature.querySelector('.flex-sections');

  if (flexSections) {
    // Remove sidebar ad + other content
    const sidebarsMd = flexSections.querySelectorAll('.col-md-4');
    sidebarsMd.forEach((section) => {
      section.remove();
    });
    const sidebarsLg = flexSections.querySelectorAll('.col-lg-4');
    sidebarsLg.forEach((section) => {
      section.remove();
    });
    const afterPostContent = flexSections.querySelectorAll(
      '.after-post-content',
    );
    afterPostContent.forEach((section) => {
      section.remove();
    });
    const controls = flexSections.querySelectorAll(
      '.header-meta.header-controls',
    );
    controls.forEach((section) => {
      section.remove();
    });

    const content = Array.from(flexSections.children).reduce(
      (article, contentBlock) => {
        if (Array.from(contentBlock.classList).includes('after-post-content')) {
          return article;
        }

        let newString = article;

        if (contentBlock.outerHTML) {
          newString += contentBlock.outerHTML;
        }

        return newString;
      },
      '',
    );

    return { featureLayoutHeader, pictureMarkup, content };
  }

  throw new Error('no flexSections found');
};

const getSimpleArticleContent = (articleLayoutSimple: Element) => {
  const newArticleLayoutSimple = articleLayoutSimple.cloneNode(true) as Element;

  const simpleLayoutHeader =
    newArticleLayoutSimple.querySelector('.article-header');

  const headerMeta = simpleLayoutHeader?.querySelector('.header-meta');
  // Remove share article text
  headerMeta?.remove();

  const title =
    simpleLayoutHeader?.querySelector<HTMLHeadingElement>('h1.title');

  const content =
    newArticleLayoutSimple.querySelectorAll<HTMLElement>('.wysiwyg-content');

  // Remove email signup block
  content.forEach((contentBlock) => {
    const afterPostContent = contentBlock.querySelectorAll(
      '.after-post-content',
    );

    afterPostContent.forEach((section) => {
      section.remove();
    });
  });

  const combinedContent = Array.from(content).reduce((acc, arrContent) => {
    const additional = Array.from(arrContent.children).reduce(
      (article, contentBlock) => {
        return article + contentBlock.outerHTML;
      },
      '',
    );

    return acc + additional;
  }, '');

  const chapterTitle = title?.innerHTML ?? 'No Chapter Title';

  return {
    chapterTitle: clearNewlinesAndFormatting(chapterTitle),
    simpleLayoutHeader: simpleLayoutHeader?.outerHTML ?? '',
    combinedContent,
  };
};

const getHarpersIndex = (harpersIndex: Element) => {
  const heading = harpersIndex.querySelector('h1');
  const headingMarkup = heading?.outerHTML ?? '';
  const body = harpersIndex.querySelector('.page-container');

  if (!body) {
    throw new Error("Harper's Index error!");
  }

  const linkedSources = body.querySelectorAll('.index-tooltip');
  linkedSources.forEach((linkedSource) => {
    linkedSource.remove();
  });

  return { headingMarkup, body };
};

const processContent = (articleDom: jsdom.JSDOM, dom: jsdom.JSDOM) => {
  const articleLayoutFeature = articleDom.window.document.querySelector(
    '.article-layout-featured',
  );

  if (articleLayoutFeature) {
    const { featureLayoutHeader, pictureMarkup, content } =
      getFeatureArticleContent(articleLayoutFeature);

    dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article>${featureLayoutHeader}${pictureMarkup}${content}</article>`;

    return undefined;
  }

  const articleLayoutSimple = articleDom.window.document.querySelector(
    '.article-layout-simple',
  );

  if (articleLayoutSimple) {
    const { chapterTitle, simpleLayoutHeader, combinedContent } =
      getSimpleArticleContent(articleLayoutSimple);

    dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article><h2 class="chapter">${chapterTitle}</h2>${simpleLayoutHeader}${combinedContent}</article>`;

    return undefined;
  }

  const harpersIndex = articleDom.window.document.querySelector(
    '.post-type-archive-index',
  );

  if (harpersIndex) {
    const { headingMarkup, body } = getHarpersIndex(harpersIndex);

    dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article>${headingMarkup}${body.outerHTML}</article>`;
    return undefined;
  }

  const findings = articleDom.window.document.querySelector(
    '.article-layout-finding',
  );

  if (findings) {
    const content = findings.querySelector('.flex-sections');

    if (!content) {
      throw new Error('Findings error!');
    }

    dom.window.document.body.innerHTML = `${dom.window.document.body.innerHTML}<article><${content.outerHTML}</article>`;

    return undefined;
  }

  console.error('Unresolved path!');

  return undefined;
};

async function processHrefs(
  hrefs: string[],
  volumeNumberAndDate: string,
  options: ReturnType<typeof getOptions>,
) {
  const dom = new JSDOM('<!DOCTYPE html>');
  dom.window.document.body.innerHTML = `<h1 class="book">${publicationName} ${volumeNumberAndDate}</h1>`;

  for (const href of hrefs) {
    // Get articles
    console.log(`Fetching: ${href}`);

    try {
      const result = await fetchContent(href, options);
      if (!isNotNullish(result)) {
        throw new Error('fetchContent error!');
      }

      const articleDom = new JSDOM(result);

      const paywall = articleDom.window.document.getElementById(
        'leaky_paywall_message',
      );

      if (paywall) throwCookieError();

      processContent(articleDom, dom);
    } catch (e: unknown) {
      handleError(e);
    }
  }

  writeHtmlFile({
    html: dom.window.document.body.innerHTML,
    publicationName,
    shorthand: 'harpers',
    volumeNumberAndDate,
  });

  const epub = await getEpub({
    publicationName,
    shorthand: 'harpers',
    volumeNumberAndDate,
  });

  console.log('Fetching complete!');

  return {
    html: dom.window.document.body.outerHTML,
    epub,
    volumeNumberAndDate,
    publicationName,
  };
}

export default async function harpersParser(issueUrl: string) {
  const headers = {
    cookie,
  };

  const options = getOptions({ headers, issueUrl });

  // Get list of articles from the Table of Contents
  // Q1/Q2 2020 redesign is a little all over the place
  // This does not grab the artwork they print anymore
  // It's a slideshow: .issue-slideshow
  const result = await fetchContent(issueUrl, options);

  if (!isNotNullish(result)) {
    throw new Error('fetchContent error!');
  }

  const dom = new JSDOM(result);

  const readings = dom.window.document.querySelector('.issue-readings');

  const readingsLinks =
    readings?.querySelectorAll<HTMLAnchorElement>('a.ac-title') ?? [];

  const readingsHrefs = Array.from(readingsLinks).map((a) => a.href);

  const articles = dom.window.document.querySelector('.issue-articles');

  const articleLinks =
    articles?.querySelectorAll<HTMLAnchorElement>('a:not([rel="author"])') ??
    [];

  const articleHrefs = Array.from(
    new Set(Array.from(articleLinks).map((a) => a.href)),
  );

  const hrefs = [...readingsHrefs, ...articleHrefs];

  const newRefs = hrefs.filter(
    (href) => href !== 'https://harpers.org/puzzles/',
  );

  const header = dom.window.document.querySelector('h1');

  const volumeNumberAndDate = header?.innerHTML ?? 'UNKNOWN';

  return processHrefs(
    newRefs,
    clearNewlinesAndFormatting(volumeNumberAndDate),
    options,
  );
}
