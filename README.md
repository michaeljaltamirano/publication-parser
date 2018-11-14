# lrb-parser

Inspired by thoughts I've had for a while of automating the importing of articles to one of my favorite applications, Voice Dream Reader, I sought out a way to pull the article contents of an entire issue of the London Review of Books from just the table of contents.

The command-line application is heavy-handed, but for now it gets the job done, pulling all the content and outputted a single HTML file with the Volume and Issue number as the file name.

To function, it requires Node 8 or greater (for async/await) and to add an env.js file with the cookie request headers.
