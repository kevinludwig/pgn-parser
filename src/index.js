import pegjs from 'pegjs';
import grammar from './grammar.peg';
const parser = pegjs.generate(grammar);

export const parse = (s) => parser.parse(s);
export default {
    parse
};
