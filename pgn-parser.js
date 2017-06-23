#!/usr/local/bin/node
const fs = require('fs'),
      pgnParser = require('./index');

pgnParser((err, parser) => {
    fs.readFile(process.argv[2], 'utf-8', (err, data) => {
        console.log(JSON.stringify(parser.parse(data), null, 2));
    });
});
