const https = require('https');
const cheerio = require('cheerio');

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, status: res.statusCode, html }));
    });
  });
}

async function test() {
  const url = 'https://www.thegioididong.com/tin-tuc/khuyen-mai';
  const res = await fetchUrl(url);
  console.log(`TGDD Status: ${res.status}, Length: ${res.html.length}`);

  const $ = cheerio.load(res.html);
  const items = [];
  $('ul.news-list > li, div.news-list > div, article, .item-news, a.link-news').each((_, el) => {
    const block = $(el);
    const a = block.find('a[href]').first();
    const href = a.attr('href') || block.attr('href');
    const title = block.find('h3, h2, .title, strong').text().trim() || a.text().trim();
    const img = block.find('img').attr('data-src') || block.find('img').attr('src');
    if (href && title.length > 10) {
      items.push({ title, href, img });
    }
  });

  console.log(`TGDD extracted items: ${items.length}`);
  items.slice(0, 10).forEach((it, i) => console.log(`${i + 1}. [${it.title}] => ${it.href} (Img: ${it.img})`));
}

test();
