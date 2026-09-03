const fs = require('fs');

function test() {
  const text = fs.readFileSync('scratch/next_f_decoded.txt', 'utf8');

  ['GIÁO DỤC', 'THANH TOÁN', 'DEAL SIÊU HOT'].forEach((term) => {
    console.log(`=================== SECTION: ${term} ===================`);
    let pos = 0;
    while ((pos = text.indexOf(term, pos)) !== -1) {
      console.log('Snippet at pos', pos, ':\n', text.slice(pos, pos + 1500));
      console.log('---------------------------------------------------------');
      pos += term.length;
    }
  });
}

test();
