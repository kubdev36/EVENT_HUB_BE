const fs = require('fs');

function test() {
  const text = fs.readFileSync('scratch/next_f_decoded.txt', 'utf8');

  // Search for any JSON objects containing alt or title or desktop or banner
  const regex = /\{[^{}]*?(?:alt|title|desktop|mobile|link|bannerUd)[^{}]*?\}/g;
  const matches = text.match(regex) || [];

  const items = [];
  matches.forEach((m) => {
    if (m.includes('Hà Nội') || m.includes('An Giang') || m.includes('Bình Dương') || m.includes('Cần Thơ')) return;
    items.push(m);
  });

  console.log('Filtered promo objects count:', items.length);
  items.slice(0, 40).forEach((it, idx) => console.log(`${idx + 1}.`, it.slice(0, 180)));
}

test();
