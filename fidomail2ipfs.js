var fs = require('fs');
var path = require('path');
var async = require('async');
var EFGH = require('efgh');
var escapeHTML = require('lodash.escape');
var extend = require('extend');
var IPFSAPI = require('ipfs-api');

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
   messageText: ''
};

var errors = {
   bootstrap: 'Cannot store Bootstrap in IPFS.',
   message: 'Error putting a Fidonet HTML5 message to IPFS.',
   EFGHCSS: 'Error putting EFGHCSS to IPFS.',
   notArr: 'Not an Array received while putting content to IPFS.',
   weirdArr: 'Weird array received while putting content to IPFS.',
   undefinedHash: 'Undefined hash received while putting content to IPFS.'
};

// cache:
var templateHTML = false;
var bootstrapIPFS = false;
var EFGHCSSIPFSURL = false;

module.exports = (settings, storageDone) => {
   var options = extend({}, defaults, settings);
   var IPFS = IPFSAPI(options.server, options.port);

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
      callback => {
         if( bootstrapIPFS ) return callback(null); // cached

         IPFS.util.addFromFs(
            path.join(__dirname, 'bootstrap'),
            { recursive: true },
            (err, arrIPFS) => {
               if( err ) return callback(err);
               if(!( Array.isArray(arrIPFS) )) return callback(
                  new Error(errors.bootstrap)
               );
               var arrBootstrapIPFS = arrIPFS.filter(
                  nextIPFS => (nextIPFS.path || '').endsWith('bootstrap')
               );
               if( arrBootstrapIPFS.length < 1 ) return callback(
                  new Error(errors.bootstrap)
               );
               bootstrapIPFS = arrBootstrapIPFS[
                  arrBootstrapIPFS.length - 1
               ].hash; // put to cache, but is it fine? check:
               if(!( bootstrapIPFS )){
                  bootstrapIPFS = false; // invalidate cache
                  return callback( new Error(errors.bootstrap) );
               }
               return callback(null); // cached fine
            }
         );
      },
      // (cached) store in IPFS the EFGH CSS:
      callback => {
         if( EFGHCSSIPFSURL ) return callback(null); // cached

         fs.readFile(
            EFGH.pathCSS(),
            { encoding: 'utf8' },
            (err, contentEFGHCSS) => {
               if( err ) return callback(err);

               IPFS.add(
                  Buffer.from(contentEFGHCSS, 'utf8'),
                  (err, resultIPFS) => {
                     if( err ) return callback(err);
                     if(!( resultIPFS )) return callback(
                        new Error(errors.EFGHCSS)
                     );
                     if(!( Array.isArray(resultIPFS) )) return callback(
                        new Error(errors.notArr)
                     );
                     if( resultIPFS.length !== 1 ) return callback(
                        new Error(errors.weirdArr)
                     );
                     var hashIPFS = resultIPFS[0].hash;
                     if( typeof hashIPFS === 'undefined' ) return callback(
                        new Error(errors.undefinedHash)
                     );
                     // put to cache:
                     EFGHCSSIPFSURL = 'https://ipfs.io/ipfs/' + hashIPFS;
                     return callback(null);
                  }
               );
            }
         );
      },
      // generate HTML message, wrap in EFGH, store in IPFS
      callback => {
         var settingsEFGH = extend({}, options, {
            messageHTML: generateFidoHTML.fromText(options.messageText)
         });
         var resultingHTML = templateHTML.replace(
            /{{bootstrap}}/g, 'https://ipfs.io/ipfs/' + bootstrapIPFS
         ).replace(
            /{{EFGHCSSIPFSURL}}/g, EFGHCSSIPFSURL
         ).replace(
            /{{title}}/g, escapeHTML(options.subj || '')
         ).replace(
            /{{body}}/g, EFGH.sync(settingsEFGH)
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