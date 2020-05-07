import pegjs from 'pegjs';
import grammar from './grammar.peg';
export default pegjs.generate(grammar);
