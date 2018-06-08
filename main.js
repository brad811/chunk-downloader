const fs = require('fs');
const http = require("http");
const url = require("url");

// Use minimist to parse command line arguments
var argv = require('minimist')(process.argv.slice(2));

if(argv.h || argv.help) {
  console.log("Usage: main.js [options] <url>");
  console.log("Options:");
  console.log("  --numChunks=num\tNumber of chunks to download");
  console.log("  --chunkSize=num\tSize of chunks to download");
  console.log("  --outputFile=filename\tName of the file to write to");
  process.exit(0);
}

// Make sure the user supplied a url to download
if(!argv._[0]) {
  console.log("Missing URL argument!");
  process.exit(1);
}

const inputUrl = url.parse(argv._[0]);
const outputFile = argv.outputFile ? argv.outputFile : "output.jar"

// Check if the output file already exists so we don't overwrite it
if (fs.existsSync(outputFile)) {
  console.log("Output file \""+outputFile+"\" already exists!");
  process.exit(1);
}

function promiseRequestFileRange(inputUrl, size, offset, chunks, resolve) {
  const options = {
    port: inputUrl.port,
    hostname: inputUrl.hostname,
    path: inputUrl.path,
    method: "GET",
    headers: {
      'Range': 'bytes='+(offset*size)+'-'+(offset*size + size - 1),
    }
  };

  const req = http.request(options, (res) => {
    var data = [];
    res.on('data', function(chunk) {
      // Append the data chunk to our list
      data.push(chunk);
    });

    res.on('end', function() {
      // Combine all our data chunks into a single buffer
      var buffer = Buffer.concat(data);
      process.stdout.write(".")
      chunks[offset] = buffer;
      resolve();
    });
  });

  req.end();
}

var promises = []; // A list of our active promises
var chunks = {}; // Our downloaded chunks, along with their order
var numChunks = argv.numChunks ? argv.numChunks : 4;
var chunkSize = argv.chunkSize ? argv.chunkSize : 1024 * 1024;

// Start downloading in parallel using promises
for(var i=0; i<numChunks; i++) {
  var promise = new Promise(function(resolve, reject) {
    promiseRequestFileRange(inputUrl, chunkSize, i, chunks, resolve);
  });

  promises.push(promise);
}

// Wait for all promises to resolve
Promise.all(promises).then(function(values) {
  // Sort our data chunks
  var totalOutput = [];
  for(var i=0; i<numChunks; i++) {
    totalOutput.push(chunks[i]);
  }

  // Write our sorted data chunks to the output file
  fs.writeFileSync(outputFile, Buffer.concat(totalOutput), 'binary');

  console.log("Done!");
});
