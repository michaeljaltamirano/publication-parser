# Magazine Parser

Inspired by thoughts I've had of automating the importing of articles into one of my favorite applications, Voice Dream Reader, I sought out a way to pull the article contents of entire issues of journals I subscribe to, including the London Review of Books, the New York Review of Books, and Harper's Magazine, from just the online table of contents. It originally started as just `lrb-parser` but I have since expanded the scope. 

The command-line application is heavy-handed, but for now it gets the job done, pulling (most) all of the content into a single HTML file with the Volume/Issue/Date as the file name.

To function, it requires Node 8 or greater (for async/await) and to add an env.js file with the cookie request headers. I've included the example formattings in each of the respective magazine directories. 
