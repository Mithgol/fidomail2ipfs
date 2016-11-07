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
   message: 'Error putting a Fidonet HTML5 message to IPFS.',
   notArr: 'Not an Array received putting a Fidonet HTML5 message to IPFS.',
   weirdArr: 'Weird array received putting a Fidonet HTML5 message to IPFS.',
   undefinedHash: 'Undefined hash after putting a Fidonet message to IPFS.',
   notArrDir: 'Not an Array received putting a directory to IPFS.',
   notFoundDir: 'Directory not found in an Array of content put to IPFS.',
   undefinedDirHash: 'Undefined hash after putting a directory to IPFS.'
};

// cache:
var templateHTML = false;
var bootstrapIPFS = false;
var EFGHCSSIPFS = false;
var ourCSSIPFS = false;

var dirToGlobalIPFS = (IPFS, dirPath, dirName, globalName, cbErr) => {
   if( global[globalName] ) return cbErr(null); // already cached

   IPFS.util.addFromFs(
      dirPath,
      { recursive: true },
      (err, arrIPFS) => {
         if( err ) return cbErr(err);
         if(!( Array.isArray(arrIPFS) )) return cbErr(
            new Error(`[${dirName}] ${errors.notArrDir}`)
         );
         var arrDirIPFS = arrIPFS.filter(
            nextIPFS => (nextIPFS.path || '').endsWith(dirName)
         );
         if( arrDirIPFS.length < 1 ) return cbErr(
            new Error(`[${dirName}] ${errors.notFoundDir}`)
         );
         var hashIPFS = arrDirIPFS[ arrDirIPFS.length - 1 ].hash;
         // if the hash is fine, put to cache and quit
         if( hashIPFS ){
            global[globalName] = hashIPFS;
            return cbErr(null);
         }
         // otherwise invalidate cache
         global[globalName] = false;
         return cbErr(
            new Error(`[${dirName}] ${errors.undefinedDirHash}`)
         );
      }
   );
};

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
      callback => dirToGlobalIPFS(
         IPFS,
         path.join(__dirname, 'bootstrap'), 'bootstrap',
         'bootstrapIPFS', callback
      ),
      // (cached) store in IPFS the EFGH CSS:
      callback => dirToGlobalIPFS(
         IPFS,
         path.dirname( EFGH.pathCSS() ), 'styles',
         'EFGHCSSIPFS', callback
      ),
      // (cached) store in IPFS our CSS:
      callback => dirToGlobalIPFS(
         IPFS,
         path.join(__dirname, 'styles'), 'styles',
         'ourCSSIPFS', callback
      ),
      // generate HTML message, wrap in EFGH, store in IPFS
      callback => {
         var settingsEFGH = extend({}, options, {
            messageHTML: generateFidoHTML.fromText(options.messageText)
         });
         var resultingHTML = templateHTML.replace(
            /{{bootstrap}}/g, 'https://ipfs.io/ipfs/' + bootstrapIPFS
         ).replace(
            /{{EFGHCSS}}/g, 'https://ipfs.io/ipfs/' + EFGHCSSIPFS
         ).replace(
            /{{FidoMail2IPFSCSS}}/g, 'https://ipfs.io/ipfs/' + ourCSSIPFS
         ).replace(
            /{{title}}/g, escapeHTML(options.subj || '')
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