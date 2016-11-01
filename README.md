[![(a histogram of downloads)](https://nodei.co/npm-dl/fidomail2ipfs.png?height=3)](https://npmjs.org/package/fidomail2ipfs)

This module (`fidomail2ipfs`) renders echomail messages from Fidonet (generating a HTML5 representation) and saves them in [IPFS](https://ipfs.io/) (InterPlanetary File System, aka the Permanent Web, aka the Distributed Web).

This module is written in JavaScript and requires [Node.js](http://nodejs.org/) to run. It uses some ECMAScript 2015 features, and thus a relatively recent Node.js is required. This module is tested against the latest stable version of Node.js.

This module is currently in an early phase of its development and thus does not have the desired level of feature completeness.

## Purposes

Web-related applications that deal with Fidonet are likely to require URLs of Fidonet-related content. Examples:

* [`fido2rss`](https://github.com/Mithgol/fido2rss) puts URLs in headers of RSS entries

* [`fido2twi`](https://github.com/Mithgol/node-fido2twi) posts URLs in microblog entries in Twitter

However, [FGHI URL](https://github.com/Mithgol/FGHI-URL/) standard is not universally recognizable and thus directly using a FGHI URL is not likely to provide immediate access to the designated Fidonet content.

A compromise here is an URL that leads to a copy of Fidonet content — a copy wrapped in HTML5 and stored in [IPFS](https://ipfs.io/). The immutability of IPFS file entries is not a problem here (because a Fidonet echomail message is also typically not altered after it is broadcasted to the subscribers of an echomail area).

## Main dependencies

This module (`fidomail2ipfs`) mainly depends on the following Node.js modules to perform the necessary steps of its process:

* The [Fidonet HTML](https://github.com/Mithgol/node-fidonet-fidohtml) module is used to convert the Fidonet message's text to its HTML representation.

* The [EFGH](https://github.com/Mithgol/efgh/) module is used to convert the Fidonet message's metadata to an HTML representation of its header.

* The [JavaScript IPFS API](https://github.com/ipfs/js-ipfs/) client library is used to save (in IPFS) the (previously generated) HTML.

## Installing fidomail2ipfs

[![(npm package version)](https://nodei.co/npm/fidomail2ipfs.png?downloads=true&downloadRank=true)](https://npmjs.org/package/fidomail2ipfs)

* Latest packaged version: `npm install fidomail2ipfs`

* Latest githubbed version: `npm install https://github.com/Mithgol/fidomail2ipfs/tarball/master`

You may visit https://github.com/Mithgol/fidomail2ipfs#readme occasionally to read the latest `README` because the package's version is not planned to grow after changes when they happen in `README` only. (And `npm publish --force` is [forbidden](http://blog.npmjs.org/post/77758351673/no-more-npm-publish-f) nowadays.)

## Using fidomail2ipfs

When you require the installed module, you get a function that renders an echomail message (generating its HTML5 representation) and saves that messages in IPFS asynchronously.

That function has two parameters. The first parameter must be an object of settings (see below). The second parameter is a callback function with a signature `(err, URL)` that receives the URL of an IPFS-stored HTML5 page. That URL is relative to the gateway https://ipfs.io/

The following settings are expected as the properties of the aforementioned object:

* `server` — the address of the IPFS server that is used to publish the message. This property is optional; if it is missing, `'localhost'` is used by default.

* `port` — the port of the IPFS server that is used to publish the message. This property is optional; if it is missing, `5001` is used by default.

* `messageText` — the Fidonet message's text. That text is expected to be given in a JavaScript string (a Unicode string, not a binary) and with LF line endings (`'\n'`, i.e. hexadecimal `0A`).

Additionally the message's header's settings are expected. The README of [EFGH](https://github.com/Mithgol/efgh/) describes their meaning and their names (`avatarWidth`, `avatarURL`, `from`, `to`, `origAddr`, `origTime`, `procTime`, `subj`, `URL`). However, the EFGH's `messageHTML` is not expected because it is generated from the aforementioned `messageText`.

## Testing fidomail2ipfs

[![(build testing status)](https://img.shields.io/travis/Mithgol/fidomail2ipfs/master.svg?style=plastic)](https://travis-ci.org/Mithgol/fidomail2ipfs)

It is necessary to install [JSHint](http://jshint.com/) for testing.

* You may install JSHint globally (`npm install jshint -g`) or locally (`npm install jshint` in the directory of fidomail2ipfs).

After that you may run `npm test` (in the directory of fidomail2ipfs). Only the JS code errors are caught; the code's behaviour is not tested.

## License

This source code is MIT-licensed (see the `LICENSE` file).

The directory `bootstrap` contains [Bootstrap](http://getbootstrap.com/) version 3.3.7 ([customized](http://getbootstrap.com/customize/) to not contain Glyphicons) under its own [MIT license]((https://github.com/twbs/bootstrap/blob/master/LICENSE).
