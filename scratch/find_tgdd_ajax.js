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
  const url = 'https://www.thegioididong.com/tin-tuc';
  const res = await fetchUrl(url);
  const $ = cheerio.load(res.html);

  console.log('--- Searching for Xem thêm button & AJAX endpoints in TGDD ---');

  // Search for buttons or elements with xem-them / loadmore / data-url / data-cateid
  $('[class*="view-more"], [class*="load-more"], [class*="btn"], .read-more, a[href*="aj/"], div[data-url]').each((i, el) => {
    console.log(`El ${i + 1}: tag=${el.name}, class=${$(el).attr('class')}, href=${$(el).attr('href')}, data-url=${$(el).attr('data-url')}, text=${$(el).text().trim()}`);
  });

  // Search for inline script calls
  $('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('aj/') || text.includes('News') || text.includes('LoadMore')) {
      console.log(`Script ${i + 1} contains AJAX keyword! Length: ${text.length}`);
      const matches = text.match(/\/tin-tuc\/[a-zA-Z0-9_/.-]+/g) || [];
      console.log('  Matches:', Array.from(new Set(matches)).slice(0, 10));
    }
  });
}

test();
