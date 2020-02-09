# Publication Parser

Publication Parser is a command line application that pulls a full issue from a given magazine provided a table of contents webpage. The current magazines supported are: The London Review of Books, The New York Review of Books, Harper's Magazine, and Bookforum. It generates a single HTML file with all accessible written issue content, in addition to emailing the generated content to a recipient of choice.

Parsers are up-to-date as of February 2020:

1. London Review of Books (updated for December 2019 website change)
1. Bookforum (updated for May 2019 website change)
1. Harper's Magazine
1. The New York Review of Books

To function, it requires Node 8 or greater (for async/await) and an env.js file with the necessary cookie and email information. I've included example formatting in each of the respective parser files. I pulled the information using a browser's dev tools network tab. Required dependencies can be installed via `yarn install`. 

I created this application to import writing into a text-to-speech application. I welcome contributions for supporting additional publications.
