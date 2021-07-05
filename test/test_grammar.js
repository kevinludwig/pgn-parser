const chai = require('chai'),
      path = require('path'),
      fs = require('fs'),
      parser = require('../dist/pgn-parser'),
      should = chai.should();

describe('grammar', () => {
    it('should parse basic movetext', () => {
        const [result] = parser.parse('1. e4 e5 2. d4 exd4 3. Qxd4 Nc6 4. Qe3 Nf6 *');
        result.moves.should.have.lengthOf(8);
    });

    it('should parse headers', () => {
        const [result] = parser.parse('[Event "LACC Botvinnik Open"]\n[White "Kasparov"]\n1. d4 d5 2. c4 c6 3. cxd5 cxd4 1/2-1/2');
        result.moves.should.have.lengthOf(6);
    });

    it('should allow no move numbers', () => {
        const [result] = parser.parse('e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 *');
        result.moves.should.have.lengthOf(12);
    });

    it('should allow move numbers no periods', () => {
        const [result] = parser.parse('1 e4 e5 2 Nf3 Nc6 3 Bc4 Bc5 4 b4 Bxb4 5 c3 Ba5 6 d4 exd4 *');
        result.moves.should.have.lengthOf(12);
    });

    it('should allow castles', () => {
        const [result] = parser.parse('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O dxc3 *');
        result.moves.should.have.lengthOf(14);
    });

    it('should allow castles long', () => {
        const [result] = parser.parse('1. e4 d5 2. exd5 Qxd5\n3. Nf3 Bg4\n4. Be2 Nc6\n5. h3 O-O-O\n*');
        result.moves.should.have.lengthOf(10);
    });

    it('should allow promotions', () => {
        const [result] = parser.parse('1. e4 e5 2. Nf3 Nc6 3. f8=Q+ dxe1=N+ *');
        result.moves.should.have.lengthOf(6);
    });
    
    it('should allow newlines', () => {
        const [result] = parser.parse('1. e4 e5\n2. Nf3 Nc6\n3.Bc4 Bc5 1-0');
        result.moves.should.have.lengthOf(6);
    });

    it('should allow checkmates', () => {
        const [result] = parser.parse('1. f3 e5 2. g4 Qh4#\n0-1');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow NAG', () => {
        const [result] = parser.parse('1. f3 $2 e5 $1 2. g4 $4 $15 Qh4#\n0-1');
        result.moves.should.have.lengthOf(4);
    });
    
    it('should allow alternative to NAGs !,?,!?,?!,!!,??', () => {
        const [result] = parser.parse('1. f3? e5! 2. g4?? axb6?! 3. bxa8=N!? Qh4+!!\n0-1');
        result.moves.should.have.lengthOf(6);
    });

    it('should allow commentary', () => {
        const [result] = parser.parse('1. f3 {some comment} e5 {another comment} 2. g4 Qh4#\n0-1');
        result.moves.should.have.lengthOf(4);
    });
    
    it('should allow start of game commentary', () => {
        const [result] = parser.parse('{start of game} 1. f3 e5 2. g4 Qh4#\n0-1');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow disambiguation moves', () => {
        const [result] = parser.parse('1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. e3 Nbd7 *');
        result.moves.should.have.lengthOf(10);
    });

    it('should allow ... prefixed on moves', () => {
        const [result] = parser.parse('1. d4 {some commentary then} 1. ...d5 2. c4 dxc4 *');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow RAV', () => {
        const [result] = parser.parse('1. e4 (1. d4 d5 ) e5 2. d4 (2. Nf3 Nc6 ) exd4 *');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow RAV of single move', () => {
        const [result] = parser.parse('1. e4 (1. d4 ) e5 2. d4 exd4 *');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow RAV with comments', () => {
        const [result] = parser.parse('1. e4 ({c1} {c2} 1. d4 d5) e5 2. d4 exd4 *');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow RAV with no trailing whitespace', () => {
        const [result] = parser.parse('1. e4 (1. d4 d5) e5 2. d4 exd4 *');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow move after RAV without whitespace', () => {
        const [result] = parser.parse('1. e4 (1. d4 d5)e5 2. d4 exd4 *');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow RAV after RAV without whitespace', () => {
        const [result] = parser.parse('1. e4 (1. d4 d5)(1. f4 e5)e5 2. d4 exd4 *');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow promotion without equal sign', () => {
        const [result] = parser.parse('1. e4 f5 2. exf5 g6 3. fxg6 h6 4. g7 Rh7 5. gxf8Q+ *');
        result.moves.should.have.lengthOf(9);
    });

    it('should allow multiple RAV for same move', () => {
        const [result] = parser.parse('1. e4 (1. d4 d5) (1. c4 e5) e5 *');
        result.moves.should.have.lengthOf(2);
        result.moves[0].ravs.should.have.lengthOf(2);
    });

    it('should allow 4...exd4 syntax', () => {
        const [result] = parser.parse('1. e4 e5 (1...c5 2. Nf3 Nc6) 2. f4 exf4 *');
        result.moves.should.have.lengthOf(4);
    });

    it('should allow whitespace after result', () => {
        const [result] = parser.parse('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O d6 6. Re1 1-0 ');
        result.moves.should.have.lengthOf(11);
    });

    it('should allow half move at end', () => {
        const [result] = parser.parse('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O d6 6. Re1 1-0');
        result.moves.should.have.lengthOf(11);
    });
    
    it('should allow abandoned games (no moves)', () => {
        const [result] = parser.parse('[Termination "Abandoned"]\n\n*');
        result.moves.should.have.lengthOf(0);
    });

    it('should allow multiple games in input', () => {
        const results = parser.parse('1. d4 d5 2. c4 c6 *\n1. e4 e5 2. d4 exd4 3. c3 dxc3 4. Bc4 cxb2 5. Bxb2 d6 1/2-1/2');
        results.should.have.lengthOf(2);
        results[0].moves.should.have.lengthOf(4);
        results[1].moves.should.have.lengthOf(10);
    });

    it('should disambiguate both rank and file', () => {
        const results = parser.parse('1. d4 d5 2. Nc3 Nf6 3. Ne4?? h6?? 4. Ng5?? a6?? 5. Ng5f3! 1/2-1/2');
        results.should.have.lengthOf(1);
        results[0].moves.should.have.lengthOf(9);
    });

    it('should allow single line comments', () => {
        const results = parser.parse('; lead comment\n[SomeHeader "Value"]\n\n1. e4 e5 *');
        results.should.have.lengthOf(1);
        results[0].comments_above_header.should.have.lengthOf(1);
        results[0].comments_above_header[0].text.should.be.eql(' lead comment');
    });

    it('should support multiple comments between half-moves', () => {
        const results = parser.parse('1. e4 { this is a comment } { [%csl Gd5,Gf5][%cal Ge4d5,Ge4f5] } *');
        results[0].moves.should.have.lengthOf(1);
    });

    it('should fully parse command commments', () => {
        const results = parser.parse('1. e4 { this is a comment } { [%csl Gd5,Gf5][%cal Ge4d5,Ge4f5] } *');
        results[0].moves.should.have.lengthOf(1);
        results[0].moves[0].comments.should.have.lengthOf(2);
        results[0].moves[0].comments[0].text.should.be.eql(' this is a comment ');
        results[0].moves[0].comments[1].commands.should.have.lengthOf(2);
        results[0].moves[0].comments[1].commands[0].key.should.be.eql('csl');
        results[0].moves[0].comments[1].commands[0].values.should.be.eql(['Gd5', 'Gf5']);
    });

    it('should parse accented characters', () => {
        const results = parser.parse('1.e4 {A à E é I î O ô U ù Y} *');
        results[0].moves[0].comments.should.have.lengthOf(1);
        results[0].moves[0].comments[0].text.should.be.eql('A à E é I î O ô U ù Y');
    });

    it('should parse null moves', () => {
        const [result] = parser.parse('[Event "Turkey Cup 2014"]\n[Site "Kemer TUR"]\n[Date "2014.02.02"]\n[Round "2.71"]\n[White "Subasi,Zeki"]\n[Black "Yuvarlak,U"]\n[Result "1/2-1/2"]\n[WhiteElo "1714"]\n[BlackElo "1850"]\n[ECO "C45"]\n[Opening "Scotch"]\n[Variation "Schmidt variation"]\n[WhiteFideId "6345433"]\n[BlackFideId "6305598"]\n[EventDate "2014.02.01"]\n1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Bb4 6. Nxc6 bxc6 7. Bd3 d5 8.\nO-O Bxc3 9. bxc3 dxe4 10. Qe2 O-O 11. Bxe4 Re8 12. f3 Bf5 13. Bg5 -- 14. Rad1\nQe7 15. Bxf6 Qxf6 16. Qc4 Rad8 17. Bxc6 1/2-1/2\n')
        result.moves.should.have.lengthOf(33);
    });
});
