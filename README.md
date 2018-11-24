# Magazine Parser

Magazine Parser is a command line application that pulls a full issue from a given magazine provided a table of contents webpage. The current magazines supported are: The London Review of Books, The New York Review of Books, Harper's Magazine, and Bookforum. It generates a single HTML file with all accessible written issue content.

To function, it requires Node 8 or greater (for async/await) and an env.js file with the necessary cookie information. I've included example formatting in each of the respective parser files. I pulled the information using a browser's dev tools network tab.

I created this application to import writing into a text-to-speech application. I welcome contributions for supporting additional publications.
