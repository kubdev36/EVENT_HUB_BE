const https = require('https');
const cheerio = require('cheerio');

function fetchHtml(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, status: res.statusCode, html }));
    });
  });
}

async function test() {
  const urls = [
    'https://cellphones.com.vn/danh-sach-khuyen-mai',
    'https://cellphones.com.vn/uu-dai-smember',
    'https://cellphones.com.vn/s-student',
  ];

  for (const u of urls) {
    const res = await fetchHtml(u);
    console.log(`\nURL [${u}]: Status ${res.status}, Length ${res.html.length}`);
    const $ = cheerio.load(res.html);
    const links = [];
    $('a[href]').each((_, el) => {
      const a = $(el);
      const href = a.attr('href');
      const title = a.text().replace(/\s+/g, ' ').trim() || a.attr('title') || a.find('img').attr('alt') || '';
      const img = a.find('img').attr('src') || a.find('img').attr('data-src') || '';
      if (href && title.length > 3) {
        links.push({ title, href, img });
      }
    });
    console.log('Found links:', links.length);
    links.slice(0, 10).forEach((l) => console.log(' -', l.title, '=>', l.href));
  }
}

test();
