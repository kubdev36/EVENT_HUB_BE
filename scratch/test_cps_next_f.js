const fs = require('fs');

function test() {
  const html = fs.readFileSync('scratch/cps_page.html', 'utf8');

  // Extract all self.__next_f.push lines
  const lines = html.match(/self\.__next_f\.push\(\[1,"(.*?)"\]\)/g) || [];
  console.log('Total __next_f.push lines:', lines.length);

  const fullText = lines.map((l) => {
    return l
      .replace(/^self\.__next_f\.push\(\[1,"/, '')
      .replace(/"\]\)$/, '')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n');
  }).join('\n');

  fs.writeFileSync('scratch/next_f_decoded.txt', fullText);
  console.log('Decoded next_f payload length:', fullText.length);

  // Search decoded text for terms
  ['GIÁO DỤC', 'THANH TOÁN', 'DEAL SIÊU HOT', 'HomeCredit', 'HSBC', 'Nam Á', 'Laptop', 'sinhvien', 'uu_dai'].forEach((t) => {
    const count = (fullText.match(new RegExp(t, 'gi')) || []).length;
    console.log(`Term "${t}": count = ${count}`);
  });
}

test();
