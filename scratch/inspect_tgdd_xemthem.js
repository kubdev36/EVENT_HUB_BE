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
  console.log(`TGDD Main News Status: ${res.status}, Length: ${res.html.length}`);

  const $ = cheerio.load(res.html);

  console.log('--- Inspecting category links on TGDD tin-tuc ---');
  const categories = new Map();
  $('a[href*="/tin-tuc/"]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (href && text.length > 3 && (href.includes('/tin-khuyen-mai') || href.match(/\/tin-tuc\/[a-z0-9-]+\/\d+/))) {
      categories.set(href, text);
    }
  });

  console.log('Found TGDD news category URLs:');
  categories.forEach((t, u) => console.log(`  [${t}] => ${u}`));

  // Check AJAX endpoints on TGDD (NewsV2 / NewsGrid / LoadMoreNews)
  console.log('\n--- Testing TGDD AJAX LoadMore endpoints ---');
  const ajaxEndpoints = [
    'https://www.thegioididong.com/tin-tuc/aj/NewsV2/NewsGrid?pageSize=20&pageIndex=1',
    'https://www.thegioididong.com/tin-tuc/aj/NewsV2/NewsGrid?pageSize=20&pageIndex=2',
    'https://www.thegioididong.com/tin-tuc/aj/NewsV2/NewsGrid?cateId=31&pageSize=20&pageIndex=1',
    'https://www.thegioididong.com/tin-tuc/aj/NewsV2/NewsGrid?cateId=31&pageSize=20&pageIndex=2',
  ];

  for (const ep of ajaxEndpoints) {
    const r = await fetchUrl(ep);
    console.log(`AJAX: [${ep}] => Status: ${r.status}, Length: ${r.html.length}`);
    if (r.status === 200 && r.html.length > 500) {
      const $c = cheerio.load(r.html);
      console.log('  Extracted items in AJAX:', $c('a[href]').length);
      $c('a[href]').slice(0, 3).each((i, el) => console.log(`    ${i + 1}. [${$c(el).text().trim()}] => ${$c(el).attr('href')}`));
    }
  }
}

test();
