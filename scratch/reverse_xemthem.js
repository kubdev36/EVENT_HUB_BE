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
  // ===== TGDD =====
  console.log('===== TGDD tin-tuc =====');
  const tgdd = await fetchUrl('https://www.thegioididong.com/tin-tuc');
  const $t = cheerio.load(tgdd.html);

  // Find "Xem thêm" button and its attributes / parent data
  $t('a, button, div, span').each((_, el) => {
    const text = $t(el).text().replace(/\s+/g, ' ').trim();
    if (text.toLowerCase().includes('xem thêm') || text.toLowerCase().includes('xem them') || $t(el).hasClass('view-more') || $t(el).hasClass('viewmore')) {
      console.log(`TGDD Xem thêm element: tag=${el.name}, class=${$t(el).attr('class')}, id=${$t(el).attr('id')}, href=${$t(el).attr('href')}, onclick=${$t(el).attr('onclick')}, data-cateid=${$t(el).attr('data-cateid')}, data-page=${$t(el).attr('data-page')}, text="${text.slice(0, 50)}"`);
      // Check parent attributes
      const parent = $t(el).parent();
      console.log(`  Parent: tag=${parent[0]?.name}, class=${parent.attr('class')}, id=${parent.attr('id')}, data-url=${parent.attr('data-url')}`);
    }
  });

  // Search script tags for loadMore / viewMore / xem-them / NewsGrid handlers
  $t('script').each((i, el) => {
    const text = $t(el).html() || '';
    if (text.includes('viewmore') || text.includes('view-more') || text.includes('loadmore') || text.includes('load-more') || text.includes('NewsGrid') || text.includes('xemthem')) {
      console.log(`\nTGDD Script ${i} contains loadmore pattern! Length: ${text.length}`);
      // Extract the relevant snippet
      const patterns = ['viewmore', 'view-more', 'loadmore', 'load-more', 'NewsGrid', 'xemthem', 'Xem thêm'];
      for (const p of patterns) {
        const idx = text.indexOf(p);
        if (idx !== -1) {
          console.log(`  Pattern "${p}" found at char ${idx}:`);
          console.log(`  Context: ...${text.slice(Math.max(0, idx - 100), idx + 300)}...`);
        }
      }
    }
  });

  // ===== FPT =====
  console.log('\n\n===== FPT Shop tin-khuyen-mai =====');
  const fpt = await fetchUrl('https://fptshop.com.vn/tin-tuc/tin-khuyen-mai');
  const $f = cheerio.load(fpt.html);

  $f('a, button, div, span').each((_, el) => {
    const text = $f(el).text().replace(/\s+/g, ' ').trim();
    if ((text.toLowerCase().includes('xem thêm') || text.toLowerCase().includes('xem them') || $f(el).hasClass('view-more') || $f(el).hasClass('viewmore')) && text.length < 30) {
      console.log(`FPT Xem thêm element: tag=${el.name}, class=${$f(el).attr('class')}, id=${$f(el).attr('id')}, href=${$f(el).attr('href')}, onclick=${$f(el).attr('onclick')}, data-page=${$f(el).attr('data-page')}, text="${text}"`);
      const parent = $f(el).parent();
      console.log(`  Parent: tag=${parent[0]?.name}, class=${parent.attr('class')}, id=${parent.attr('id')}`);
    }
  });

  // Search FPT scripts for loadMore / xem-them handlers
  $f('script').each((i, el) => {
    const text = $f(el).html() || '';
    if (text.includes('loadMore') || text.includes('load_more') || text.includes('xemthem') || text.includes('LoadMoreNews') || (text.includes('Xem') && text.includes('thêm'))) {
      console.log(`\nFPT Script ${i} contains loadmore pattern! Length: ${text.length}`);
      const patterns = ['loadMore', 'load_more', 'xemthem', 'LoadMoreNews', 'fetchMore'];
      for (const p of patterns) {
        const idx = text.indexOf(p);
        if (idx !== -1) {
          console.log(`  Pattern "${p}" found at char ${idx}:`);
          console.log(`  Context: ...${text.slice(Math.max(0, idx - 100), idx + 400)}...`);
        }
      }
    }
  });
}

test();
