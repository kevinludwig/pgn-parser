const fs = require('fs'),
      path = require('path'),
      pegjs = require('pegjs');

module.exports = function(callback) {
    fs.readFile(path.join(__dirname, 'grammar.peg'), 'utf-8', function(err, data) {
        if (err) {
            callback(err);
        } else {
            callback(null, pegjs.generate(data));
        }
    });
};
