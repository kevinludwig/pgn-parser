#!/usr/local/bin/node
const fs = require('fs'),
      parser = require('../dist/pgn-parser');

fs.readFile(process.argv[2], 'utf-8', (err, data) => {
    if (err) {
        console.log(err);
        process.exit(1);
    } else {
        console.log(JSON.stringify(parser.parse(data), null, 2));
    }
});
