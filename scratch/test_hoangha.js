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
  const url = 'https://hoanghamobile.com/tin-tuc/category/khuyen-mai/';
  const res = await fetchHtml(url);
  console.log(`Hoàng Hà Status: ${res.status}, HTML length: ${res.html.length}`);

  const $ = cheerio.load(res.html);

  console.log('\n--- Checking Pagination Links ---');
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && (href.includes('page') || href.includes('category/khuyen-mai') || text.match(/\d+/))) {
      console.log(`Pagination / Page Link: [${text}] => ${href}`);
    }
  });

  console.log('\n--- Checking Article / Item Elements ---');
  const items = [];
  $('article, .item, .post-item, .news-item, .col-content, div[class*="post"], div[class*="item"]').each((_, el) => {
    const block = $(el);
    const a = block.find('a[href]').first();
    const href = a.attr('href') || block.attr('href');
    const title = block.find('h1, h2, h3, h4, .title, a').text().replace(/\s+/g, ' ').trim();
    const img = block.find('img').attr('src') || block.find('img').attr('data-src') || block.find('img').attr('data-original');

    if (href && title.length > 10 && !items.some((i) => i.href === href)) {
      items.push({ title, href, img });
    }
  });

  console.log(`Extracted items count on page 1: ${items.length}`);
  items.forEach((it, idx) => console.log(`${idx + 1}. [${it.title}] => ${it.href} (Img: ${it.img || 'None'})`));

  // Check RSS feed for Hoàng Hà category
  const rssUrl = 'https://hoanghamobile.com/tin-tuc/category/khuyen-mai/feed/';
  const rssRes = await fetchHtml(rssUrl);
  console.log(`\nHoàng Hà RSS Feed Status: ${rssRes.status}, Length: ${rssRes.html.length}`);
  if (rssRes.status === 200) {
    const $rss = cheerio.load(rssRes.html, { xmlMode: true });
    const rssItems = [];
    $rss('item').each((_, el) => {
      const item = $rss(el);
      const title = item.find('title').text().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      const link = item.find('link').text().trim();
      const rawContent = item.find('content\\:encoded').text() || item.find('description').text();
      const $c = cheerio.load(rawContent);
      const img = $c('img').first().attr('src');
      rssItems.push({ title, link, img });
    });
    console.log(`Hoàng Hà RSS Items count: ${rssItems.length}`);
    rssItems.forEach((it, idx) => console.log(`${idx + 1}. [${it.title}] => ${it.link} (Img: ${it.img || 'None'})`));
  }
}

test();
