const fs = require('fs');

function test() {
  const html = fs.readFileSync('scratch/cps_page.html', 'utf8');

  const terms = ['GIÁO DỤC', 'THANH TOÁN', 'DEAL SIÊU HOT', 'HOMECREDIT', 'HSBC', 'Laptop AI', 'Ưu đãi Laptop', 'STUDENT'];

  terms.forEach((t) => {
    const idx = html.indexOf(t);
    console.log(`Term "${t}": found at index ${idx}`);
    if (idx !== -1) {
      console.log('Snippet around term:\n', html.slice(Math.max(0, idx - 200), Math.min(html.length, idx + 400)));
      console.log('--------------------------------------------------');
    }
  });
}

test();
