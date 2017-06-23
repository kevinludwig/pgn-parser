### pgn-parser

Parse PGN files into a JS data structure (and syntax validation on the PGN)

### Usage

From the command line: `pgn-parser.js some/pgn/file.pgn`

From js

```
const pgnParser = require('pgn-parser');

pgnParser((err, parser) => {
    const [result] = parser.parse("1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O Nge7");
    console.log(result);
});

```

### Run tests

```

npm install
npm test

```

