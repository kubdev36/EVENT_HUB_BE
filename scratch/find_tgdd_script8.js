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

  const text = $('script').eq(7).html() || '';
  console.log('Script 8 length:', text.length);

  // Search for AJAX endpoint paths
  const apis = text.match(/\/tin-tuc\/[a-zA-Z0-9_/.-]+/g) || [];
  console.log('Unique path matches in Script 8:');
  Array.from(new Set(apis)).forEach((a) => console.log('  ', a));

  // Search for $.ajax or fetch calls
  const fetchCalls = text.match(/url\s*:\s*['"]([^'"]+)['"]/g) || [];
  console.log('\nURL parameters in $.ajax:');
  Array.from(new Set(fetchCalls)).forEach((f) => console.log('  ', f));
}

test();
