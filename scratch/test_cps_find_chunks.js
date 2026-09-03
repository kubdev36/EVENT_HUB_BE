const https = require('https');
const fs = require('fs');

function getHtml(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
  });
}

async function test() {
  const html = fs.readFileSync('scratch/cps_page.html', 'utf8');

  // Match all JS chunk paths
  const chunkPaths = html.match(/\/_next\/static\/chunks\/[^"]+\.js/g) || html.match(/static\/chunks\/[^"]+\.js/g) || [];
  const uniqueChunks = [...new Set(chunkPaths)].map((p) => (p.startsWith('/') ? `https://cellphones.com.vn${p}` : `https://cellphones.com.vn/_next/${p}`));

  console.log('Found JS chunks:', uniqueChunks.length);

  for (const chunkUrl of uniqueChunks.slice(0, 10)) {
    const res = await getHtml(chunkUrl);
    console.log(`Chunk [${chunkUrl}]: Status ${res.status}`);
    if (res.body) {
      // Search for http or api or banner or khuyen mai or graphql
      const matches = res.body.match(/https?:\/\/[^\s"']+/gi) || [];
      const apiMatches = matches.filter((m) => m.includes('api') || m.includes('banner') || m.includes('promotion') || m.includes('cps'));
      if (apiMatches.length) {
        console.log('  Found APIs:', [...new Set(apiMatches)]);
      }
    }
  }
}

test();
