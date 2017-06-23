const fs = require('fs'),
      pegjs = require('pegjs');

module.exports = function(pgn, callback) {
    fs.readFile('./grammar.peg', 'utf-8', function(err, data) {
        if (err) {
            callback(err);
        } else {
            try {
                var r = parser.parse(pgn);
                callback(null, r);
            } catch (ex) {
                callback(ex);
            }
        }
    });
};
