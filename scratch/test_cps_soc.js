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
  const pageUrl = 'https://cellphones.com.vn/sforum/khuyen-mai-soc';
  const rssUrl = 'https://cellphones.com.vn/sforum/khuyen-mai-soc/feed';

  const pageRes = await fetchHtml(pageUrl);
  console.log(`Page [${pageUrl}] Status: ${pageRes.status}, Length: ${pageRes.html.length}`);

  const $ = cheerio.load(pageRes.html);
  const pageItems = [];
  $('article, [class*="post"], [class*="item"], h2 a, h3 a').each((_, el) => {
    const block = $(el);
    const a = block.is('a') ? block : block.find('a[href]').first();
    const href = a.attr('href');
    const title = a.text().replace(/\s+/g, ' ').trim() || block.find('h2, h3, h4').text().trim();
    const img = block.find('img').attr('src') || block.find('img').attr('data-src');

    if (href && title.length > 8 && !title.includes('Sforum')) {
      pageItems.push({ title, href, img });
    }
  });

  console.log('\nExtracted HTML items from Khuyến Mãi Sốc:', pageItems.length);
  pageItems.slice(0, 10).forEach((it, idx) => console.log(`${idx + 1}. [${it.title}] => ${it.href}`));

  const rssRes = await fetchHtml(rssUrl);
  console.log(`\nRSS Feed [${rssUrl}] Status: ${rssRes.status}, Length: ${rssRes.html.length}`);
  if (rssRes.status === 200) {
    const $rss = cheerio.load(rssRes.html, { xmlMode: true });
    const rssItems = [];
    $rss('item').each((_, el) => {
      const item = $rss(el);
      const title = item.find('title').text().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      const link = item.find('link').text().trim();
      rssItems.push({ title, link });
    });
    console.log('Extracted RSS items from Khuyến Mãi Sốc feed:', rssItems.length);
    rssItems.slice(0, 10).forEach((it, idx) => console.log(`${idx + 1}. [${it.title}] => ${it.link}`));
  }
}

test();
