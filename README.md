### pgn-parser

Parse PGN files into a JS data structure (and syntax validation on the PGN)

### Usage

From the command line: `pgn-parser.js some/pgn/file.pgn`

From js

```
const pgnParser = require('pgn-parser');

pgnParser((err, parser) => {
    const [result] = parser.parse('[White "me"]\n[Black "you"]\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 (3. ...Nf6 {is the two knights}) 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O Nge7 $1 *');
    console.log(result);
});

```

### Output

The result parsing the PGN above would be

```
[
    {
        headers: {
            White: "me",
            Black: "you"
        },
        result: "*",
        moves: [
            { m: 'e4', mn: 1, nags: [], ravs: [], com: null },
            { m: 'e5', mn: null, nags: [], ravs: [], com: null},
            { m: 'Nf3', mn: 2, nags: [], ravs: [], com: null},
            { m: 'Nc6', mn: null, nags: [], ravs: [], com: null},
            { m: 'Bc4', mn: 3, nags: [], ravs: [], com: null},
            { m: 'Bc5', mn: null, nags: [], ravs: [{ mn: 3, m: "...Nf6", nags: [], ravs: [], com: "is the two knights"}], com: null},
            { m: 'b4', mn: 4, nags: [], ravs: [], com: null},
            { m: 'Bxb4', mn: null, nags: [], ravs: [], com: null},
            { m: 'c3', mn: 5, nags: [], ravs: [], com: null},
            { m: 'Ba5', mn: null, nags: [], ravs: [], com: null},
            { m: 'd4', mn: 6, nags: [], ravs: [], com: null},
            { m: 'exd4', mn: null, nags: [], ravs: [], com: null},
            { m: 'O-O', mn: 7, mn: 7, nags: [], ravs: [], com: null},
            { m: 'Nge7', mn: null, nags: ["$1"], ravs: [], com: null}
        ]
    }
]
```

### Run tests

```

npm install
npm test

```

