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
  const url = 'https://cellphones.com.vn/sforum/msi-back-to-school-2026';
  const res = await fetchHtml(url);
  console.log(`Page Status: ${res.status}, Length: ${res.html.length}`);

  const $ = cheerio.load(res.html);

  console.log('OG Image:', $('meta[property="og:image"]').attr('content'));
  console.log('Twitter Image:', $('meta[name="twitter:image"]').attr('content'));

  console.log('\n--- All img tags inside body ---');
  $('img').each((i, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    const alt = $(el).attr('alt');
    console.log(`${i + 1}. src=${src} (alt: ${alt || 'None'})`);
  });

  // Test RSS feed item for this article
  const rssUrl = 'https://cellphones.com.vn/sforum/khuyen-mai-soc/feed';
  const rssRes = await fetchHtml(rssUrl);
  if (rssRes.status === 200) {
    const $rss = cheerio.load(rssRes.html, { xmlMode: true });
    $rss('item').each((_, el) => {
      const item = $rss(el);
      const link = item.find('link').text().trim();
      if (link.includes('msi-back-to-school')) {
        console.log('\n--- Found in RSS Feed ---');
        console.log('Title:', item.find('title').text());
        console.log('Link:', link);
        console.log('Enclosure:', item.find('enclosure').attr('url'));
        console.log('Media content:', item.find('media\\:content').attr('url'));
        const rawContent = item.find('content\\:encoded').text() || item.find('description').text();
        const $c = cheerio.load(rawContent);
        console.log('Content <img> src:', $c('img').first().attr('src'));
      }
    });
  }
}

test();
