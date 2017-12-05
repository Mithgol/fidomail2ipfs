var fs = require('fs');
var path = require('path');
var async = require('async');
var cheerio = require('cheerio');
var EFGH = require('efgh');
var escapeHTML = require('lodash.escape');
var unescapeHTML = require('lodash.unescape');
var extend = require('extend');
var IPFSAPI = require('ipfs-api');
var resolvePkg = require('resolve-pkg');
var truncateEscapedHTML = require('truncate-escaped-html');

var generateFidoHTML = require('fidohtml')({
   URLPrefixes: {
      '*': '', // default
      fs: IPFSURL => IPFSURL.replace( /^fs:\/*/g, 'https://ipfs.io/' ),
      ipfs: IPFSURL => IPFSURL.replace( /^ipfs:\/*/g, 'https://ipfs.io/' )
   }
});

var defaults = {
   server: 'localhost',
   port: '5001',
   messageText: '',
   twitterUser: false
};

var errors = {
   message: 'Error putting a Fidonet HTML5 message to IPFS.',
   notArr: 'Not an Array received putting a Fidonet HTML5 message to IPFS.',
   weirdArr: 'Weird array received putting a Fidonet HTML5 message to IPFS.',
   undefinedHash: 'Undefined hash after putting a Fidonet message to IPFS.',
   notArrDir: 'Not an Array received putting a directory to IPFS.',
   emptyArrDir: 'Empty Array received putting a directory to IPFS.',
   notFoundDir: 'Directory not found in an Array of content put to IPFS.',
   undefinedDirHash: 'Undefined hash after putting a directory to IPFS.'
};

var generateTwitterCard = (twitterUser, subj, msgHTML) => {
   var simpleText = unescapeHTML(
      msgHTML.replace( /<br>/g, '\n' ).replace( /<.+?>/g, '' )
   ).replace(/\n+/g, ' ').replace(/ +/g, ' ').replace(/^\s+/g, '');
   var imgSrc = cheerio('img', msgHTML).attr('src');
   var imgAlt = cheerio('img', msgHTML).attr('alt');
   if( typeof imgSrc === 'undefined' ) return '';
   return [
      '<meta name="twitter:card" content="summary_large_image" />\n',
      '<meta name="twitter:site" content="@', escapeHTML(twitterUser),
      '" />\n',
      '<meta name="og:title" content="', escapeHTML(subj), '" />\n',
      '<meta name="og:description" content="',
      // Unicode U+27A1 is a (so called) “black” rightwards arrow:
      truncateEscapedHTML(200, '\u27a1', simpleText), '" />\n',
      '<meta name="og:image" content="', escapeHTML(imgSrc), '" />',
      imgAlt ? [
         '\n', '<meta name="twitter:image:alt" content="',
         escapeHTML(imgAlt), '" />'
      ].join('') : ''
   ].join('');
};

// cache:
var templateHTML = false;
var hashCache = {
   bootstrapIPFS: false,
   EFGHCSSIPFS: false,
   ourCSSIPFS: false,
   TwitterEmoji: false
};

var dirToHashIPFS = (IPFS, dirPath, dirName, hashName, cbErr) => {
   if( hashCache[hashName] ) return cbErr(null); // already cached

   IPFS.util.addFromFs(
      dirPath,
      { recursive: true },
      (err, arrIPFS) => {
         if( err ) return cbErr(err);
         if(!( Array.isArray(arrIPFS) )) return cbErr(
            new Error(`[${dirName}] ${errors.notArrDir}`)
         );
         if( arrIPFS.length < 1 ) return cbErr(
            new Error(`[${dirName}] ${errors.emptyArrDir}`)
         );
         var lastDirIPFS = arrIPFS[ arrIPFS.length - 1 ];
         if(!(
            (lastDirIPFS.path || '').endsWith(dirName)
         )) return cbErr(
            new Error(`[${dirName}] ${errors.notFoundDir}`)
         );
         // if the hash is fine, put to cache and quit
         if( lastDirIPFS.hash ){
            hashCache[hashName] = lastDirIPFS.hash;
            return cbErr(null);
         }
         // otherwise invalidate cache
         hashCache[hashName] = false;
         return cbErr(
            new Error(`[${dirName}] ${errors.undefinedDirHash}`)
         );
      }
   );
};

module.exports = (settings, storageDone) => {
   var options = extend({}, defaults, settings);
   var IPFS = IPFSAPI(options.server, options.port);
   if(
      typeof options.twitterUser === 'string' &&
      options.twitterUser.startsWith('@')
   ) options.twitterUser = options.twitterUser.slice(1);

   async.waterfall([
      // (cached) load the HTML template from the file system:
      callback => {
         if( templateHTML ) return callback(null); // cached

         fs.readFile(
            path.join(__dirname, 'template.html'),
            { encoding: 'utf8' },
            (err, fileData) => {
               if( err ) return callback(err);
               templateHTML = fileData; // put to cache
               return callback(null);
            }
         );
      },
      // (cached) store in IPFS the customized Bootstrap:
      callback => dirToHashIPFS(
         IPFS,
         path.join(__dirname, 'bootstrap'), 'bootstrap',
         'bootstrapIPFS', callback
      ),
      // (cached) store in IPFS the EFGH CSS:
      callback => dirToHashIPFS(
         IPFS,
         path.dirname( EFGH.pathCSS() ), 'styles',
         'EFGHCSSIPFS', callback
      ),
      // (cached) store in IPFS our CSS:
      callback => dirToHashIPFS(
         IPFS,
         path.join(__dirname, 'styles'), 'styles',
         'ourCSSIPFS', callback
      ),
      // (cached) store in IPFS Twitter Emoji v2:
      callback => dirToHashIPFS(
         IPFS,
         path.join(resolvePkg('twemoji', { cwd: __dirname }), '2'), '2',
         'TwitterEmoji', callback
      ),
      // generate HTML message, wrap in EFGH, store in IPFS
      callback => {
         var FidoMessageHTML = generateFidoHTML.fromText(options.messageText);
         var settingsEFGH = extend({}, options, {
            messageHTML: FidoMessageHTML
         });
         var resultingHTML = templateHTML.replace(
            /{{bootstrap}}/g,
            'https://ipfs.io/ipfs/' + hashCache.bootstrapIPFS
         ).replace(
            /{{EFGHCSS}}/g, 'https://ipfs.io/ipfs/' + hashCache.EFGHCSSIPFS
         ).replace(
            /{{FidoMail2IPFSCSS}}/g,
            'https://ipfs.io/ipfs/' + hashCache.ourCSSIPFS
         ).replace(
            /{{TwitterEmoji}}/g,
            'https://ipfs.io/ipfs/' + hashCache.TwitterEmoji
         ).replace(
            /{{title}}/g, escapeHTML(options.subj || '')
         ).replace(
            /{{twitterCard}}/g, options.twitterUser ? generateTwitterCard(
               options.twitterUser, options.subj || '', FidoMessageHTML
            ) : ''
         ).replace(
            /{{FidonetMessage}}/g, EFGH.sync(settingsEFGH)
         );

         IPFS.add(Buffer.from(resultingHTML, 'utf8'), (err, resultIPFS) => {
            if( err ) return callback(err);
            if(!( resultIPFS )) return callback(new Error( errors.message ));
            if(!( Array.isArray(resultIPFS) )) return callback(new Error(
               errors.notArr
            ));
            if( resultIPFS.length !== 1 ) return callback(new Error(
               errors.weirdArr
            ));
            var hashIPFS = resultIPFS[0].hash;
            if( typeof hashIPFS === 'undefined' ) return callback(new Error(
               errors.undefinedHash
            ));
            callback(null, 'https://ipfs.io/ipfs/' + hashIPFS);
         });
      }
   ], storageDone);
};