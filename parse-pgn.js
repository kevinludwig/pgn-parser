#!/usr/local/bin/node
const fs = require('fs'),
      pegjs = require('pegjs');

const parser = pegjs.generate(fs.readFileSync('./grammar.peg', 'utf-8'));
const result = parser.parse(fs.readFileSync(process.argv[2], 'utf-8'));
console.log(JSON.stringify(result, null, 2));
