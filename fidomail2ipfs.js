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
   notArr: 'Not an Array received while putting a FGHI URL to IPFS.',
   weirdArr: 'Weird array received while putting a FGHI URL to IPFS.',
   undefinedHash: 'Undefined hash received while putting a FGHI URL to IPFS.'
};

// cache:
var templateHTML = false;
var bootstrapIPFS = false;

module.exports = (settings, storageDone) => {
   var options = extend({}, defaults, settings);
   var IPFS = IPFSAPI(options.server, options.port);

   async.waterfall([
      // (cached) load the HTML template from the file system:
      callback => {
         if( templateHTML ) return callback(null, templateHTML);

         fs.readFile(
            path.join(__dirname, 'template.html'),
            { encoding: 'utf8' },
            (err, fileData) => {
               if( err ) return callback(err);
               templateHTML = fileData;
               return callback(null, templateHTML);
            }
         );
      },
      // (cached) store in IPFS the customized Bootstrap:
      (templateHTML, callback) => {
         if( bootstrapIPFS ) return callback(null, {
            templateHTML: templateHTML,
            bootstrapIPFS: bootstrapIPFS
         });

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
               ].hash;
               if(!( bootstrapIPFS )) return callback(
                  new Error(errors.bootstrap)
               );
               return callback(null, {
                  templateHTML: templateHTML,
                  bootstrapIPFS: bootstrapIPFS
               });
            }
         );
      },
      // generate HTML message, wrap in EFGH, store in IPFS
      (wrapped, callback) => {
         var settingsEFGH = extend({}, options, {
            messageHTML: generateFidoHTML.fromText(options.messageText)
         });
         var templatedHTML = wrapped.templateHTML.replace(
            /{{bootstrap}}/g, 'https://ipfs.io/ipfs/' + wrapped.bootstrapIPFS
         ).replace(
            /{{title}}/g, escapeHTML(options.subj || '')
         ).replace(
            /{{body}}/g, EFGH.sync(settingsEFGH)
         );

         IPFS.add(Buffer.from(templatedHTML, 'utf8'), (err, resultIPFS) => {
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