const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
  });
}

async function run() {
  console.log('Testing Sforum FEED on CellphoneS domain...');
  const rss = await get('https://cellphones.com.vn/sforum/feed');
  console.log('RSS Status:', rss.status, 'Length:', rss.data.length);
  if (rss.data.includes('<item>')) {
    const items = rss.data.match(/<title>(.*?)<\/title>/g) || [];
    console.log('Found RSS items:', items.length);
    items.slice(0, 10).forEach((t) => console.log(' ->', t.replace(/<\/?title>/g, '')));
  }

  console.log('\nTesting Sforum WP-API on CellphoneS domain...');
  const api = await get('https://cellphones.com.vn/sforum/wp-json/wp/v2/posts?per_page=20');
  console.log('API Status:', api.status, 'Length:', api.data.length);
  try {
    const posts = JSON.parse(api.data);
    console.log('Found API posts:', posts.length);
    posts.slice(0, 10).forEach((p) => console.log(' ->', p.title?.rendered, '=>', p.link));
  } catch (e) {
    console.log('Parse error:', e.message);
  }
}

run();
