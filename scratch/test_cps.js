const https = require('https');
const cheerio = require('cheerio');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ status: res.statusCode, html }));
    });
  });
}

async function test() {
  const res = await fetch('https://cellphones.com.vn/danh-sach-khuyen-mai');
  console.log('Status:', res.status, 'HTML Length:', res.html.length);
  const $ = cheerio.load(res.html);

  console.log('--- ALL LINKS ---');
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text && text.length > 5) {
      console.log(`[${href}] => ${text.slice(0, 80)}`);
    }
  });

  const sforum = await fetch('https://sforum.vn/category/tin-khuyen-mai');
  console.log('\n--- SFORUM STATUS:', sforum.status, 'LENGTH:', sforum.html.length);
  const $s = cheerio.load(sforum.html);
  $s('article, h2, h3, .post-title, a[href*="sforum.vn"]').each((_, el) => {
    const text = $s(el).text().replace(/\s+/g, ' ').trim();
    const href = $s(el).attr('href') || $s(el).find('a').attr('href');
    if (text.length > 10 && href) {
      console.log(`SFORUM: [${href}] => ${text.slice(0, 80)}`);
    }
  });
}

test();
