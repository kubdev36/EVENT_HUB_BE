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
  // ===== TGDD: Find More() function =====
  console.log('===== TGDD: Finding More() function =====');
  const tgdd = await fetchUrl('https://www.thegioididong.com/tin-tuc');
  const $t = cheerio.load(tgdd.html);

  // Find the viewmore element's parent container and data attributes
  const viewmore = $t('a.viewmore[onclick="More(this)"]');
  console.log('viewmore parent chain:');
  let current = viewmore;
  for (let i = 0; i < 5; i++) {
    current = current.parent();
    const attrs = current[0]?.attribs || {};
    console.log(`  Level ${i + 1}: tag=${current[0]?.name}, class=${attrs.class || ''}, id=${attrs.id || ''}, data-cate=${attrs['data-cate'] || ''}, data-url=${attrs['data-url'] || ''}, data-page=${attrs['data-page'] || ''}, data-cateid=${attrs['data-cateid'] || ''}`);
  }

  // Search for "function More" in all scripts
  $t('script').each((i, el) => {
    const text = $t(el).html() || '';
    const idx = text.indexOf('function More');
    if (idx !== -1) {
      console.log(`\nFound "function More" in Script ${i}!`);
      console.log(`Context: ${text.slice(idx, idx + 500)}`);
    }
    // Also search for More = function or var More
    const idx2 = text.indexOf('More(');
    if (idx2 !== -1 && !text.slice(idx2 - 10, idx2).includes('onclick')) {
      console.log(`\nFound "More(" in Script ${i} at char ${idx2}:`);
      console.log(`Context: ${text.slice(Math.max(0, idx2 - 50), idx2 + 400)}`);
    }
  });

  // Also search for the JS file containing More function
  const jsFiles = [];
  $t('script[src]').each((_, el) => {
    const src = $t(el).attr('src');
    if (src && (src.includes('news') || src.includes('tin-tuc') || src.includes('News'))) {
      jsFiles.push(src.startsWith('http') ? src : `https://www.thegioididong.com${src}`);
    }
  });
  console.log('\nJS files related to news:', jsFiles);

  // Try fetching the news-specific JS files
  for (const js of jsFiles) {
    const r = await fetchUrl(js);
    if (r.status === 200) {
      const idx = r.html.indexOf('function More');
      if (idx !== -1) {
        console.log(`\nFound "function More" in ${js}!`);
        console.log(`Context: ${r.html.slice(idx, idx + 600)}`);
      }
      const idx2 = r.html.indexOf('More(');
      if (idx2 !== -1) {
        console.log(`\nFound "More(" in ${js} at char ${idx2}!`);
        console.log(`Context: ${r.html.slice(Math.max(0, idx2 - 100), idx2 + 500)}`);
      }
    }
  }
}

test();
