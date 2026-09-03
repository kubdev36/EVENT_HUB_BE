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
  const url = 'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai';
  const res = await fetchUrl(url);

  console.log('--- Inspecting all FPT Shop script contents for API URLs ---');
  const apiUrls = res.html.match(/"([^"]*?api[^"]*?)"/gi) || [];
  console.log('Found API strings in HTML:');
  const uniqueApis = Array.from(new Set(apiUrls)).filter((s) => s.length > 5 && s.length < 150);
  uniqueApis.forEach((a) => console.log('  ', a));

  // Check if FPT Shop uses GraphQL or Gateway
  const gqMatches = res.html.match(/"([^"]*?graphql[^"]*?)"/gi) || [];
  console.log('\nFound GraphQL strings:');
  gqMatches.forEach((g) => console.log('  ', g));
}

test();
