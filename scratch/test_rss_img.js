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

async function test() {
  const rssResp = await fetchHtml('https://cellphones.com.vn/sforum/tag/khuyen-mai/feed');
  const $rss = cheerio.load(rssResp.html, { xmlMode: true });

  const items = [];
  $rss('item').each((_, el) => {
    const item = $rss(el);
    const title = item.find('title').text().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    const url = item.find('link').text().trim() || item.find('link').attr('href');

    // Extract raw XML text of item
    const xmlText = item.html() || '';
    // Regex search for image URLs inside CDATA or content:encoded
    const imgMatches = xmlText.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/gi) || [];
    const validImg = imgMatches.find((img) => !img.includes('avatar') && !img.includes('icon') && !img.includes('logo') && !img.includes('sprite')) || null;

    items.push({ title, url, image: validImg });
  });

  console.log('Extracted RSS Items instantly:', items.length);
  items.slice(0, 10).forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.title}]\n   Image: ${item.image}\n`);
  });
}

test();
