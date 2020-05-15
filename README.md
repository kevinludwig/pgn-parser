### pgn-parser

[![Build Status](https://travis-ci.org/kevinludwig/pgn-parser.svg?branch=master)](https://travis-ci.org/kevinludwig/pgn-parser)

Parse [PGN files](https://www.chessclub.com/user/help/PGN-spec) into a JS data structure (and syntax validation on the PGN)

### Usage

From the command line: `src/pgn-parser.js some/pgn/file.pgn`

From js

```
const pgnParser = require('pgn-parser');

const [result] = pgnParser.parse('[White "me"]\n[Black "you"]\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 (3. ...Nf6 {is the two knights}) 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O Nge7 $1 *');

console.log(result);
```

### Output

The result parsing the PGN above would be

```
[
    {
        headers: [ 
            {name: "White", value: "me"},
            {name: "Black", value: "you"}
        ],
        result: "*",
        moves: [
            { move: 'e4', move_number: 1},
            { move: 'e5',
            { move: 'Nf3', move_number: 2},
            { move: 'Nc6'},
            { move: 'Bc4', move_number: 3},
            { move: 'Bc5', ravs: [{ moves: [{move_number: 3, move: "...Nf6", comments: [{text: "is the two knights"}]}]}]},
            { move: 'b4', move_number: 4},
            { move: 'Bxb4'},
            { move: 'c3', move_number: 5},
            { move: 'Ba5'},
            { move: 'd4', move_number: 6},
            { move: 'exd4'},
            { move: 'O-O', move_number: 7},
            { move: 'Nge7', nags: ["$1"]}
        ]
    }
]
```

### Run tests

```

npm install
npm test

```

