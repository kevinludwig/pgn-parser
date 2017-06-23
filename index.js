const fs = require('fs'),
      pegjs = require('pegjs');

module.exports = function(callback) {
    fs.readFile('./grammar.peg', 'utf-8', function(err, data) {
        if (err) {
            callback(err);
        } else {
            callback(null, pegjs.generate(data));
        }
    });
};
