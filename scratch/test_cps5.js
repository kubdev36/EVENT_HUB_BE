const https = require('https');
const cheerio = require('cheerio');

function fetchHtml(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, html }));
    });
  });
}

function extractFromRss($, sourceUrl) {
  const items = [];
  $('item, entry').each((_, el) => {
    const item = $(el);
    const title = item.find('title').first().text().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    const url = item.find('link').first().text().trim() || item.find('link').first().attr('href') || sourceUrl;
    const description = item.find('description, summary').first().text().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const pubDate = item.find('pubDate, published, updated').first().text().trim();

    let image = item.find('enclosure').attr('url') || item.find('media\\:content').attr('url') || null;
    if (!image) {
      const rawContent = item.text();
      const imgMatch = rawContent.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/i);
      if (imgMatch) image = imgMatch[0];
    }

    if (title.length > 8) {
      items.push({
        title,
        description: description ? description.slice(0, 150) : null,
        image,
        url,
        pubDate,
      });
    }
  });
  return items;
}

async function test() {
  const rssResp = await fetchHtml('https://cellphones.com.vn/sforum/tag/khuyen-mai/feed');
  const $rss = cheerio.load(rssResp.html, { xmlMode: true });
  const items = extractFromRss($rss, rssResp.url);
  console.log('Extracted CellphoneS RSS Items:', items.length);
  items.forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.title}] (Image: ${item.image ? 'YES' : 'NO'})`);
  });
}

test();
