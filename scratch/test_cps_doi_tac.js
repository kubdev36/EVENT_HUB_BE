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
  const res = await fetchHtml('https://cellphones.com.vn/uu-dai-doi-tac');
  console.log('uu-dai-doi-tac Status:', res.status, 'HTML Length:', res.html.length);

  const $ = cheerio.load(res.html);
  const items = [];
  $('a[href]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href');
    const title = a.text().replace(/\s+/g, ' ').trim() || a.find('img').attr('alt') || a.attr('title') || '';
    const img = a.find('img').attr('src') || a.find('img').attr('data-src') || '';
    if (href && (href.includes('uu-dai') || href.includes('khuyen-mai') || href.includes('home-credit') || href.includes('hsbc') || href.includes('nam-a'))) {
      items.push({ title, href, img });
    }
  });

  console.log('Found promo partner links:', items.length);
  items.slice(0, 15).forEach((item, idx) => console.log(`${idx + 1}. [${item.title}] => ${item.href} (Img: ${item.img})`));
}

test();
