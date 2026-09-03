const fs = require('fs');
const cheerio = require('cheerio');

function extractCellphonesPromos(html, sourceUrl) {
  const items = [];
  const $ = cheerio.load(html);

  // 1. Extract from cheerio DOM elements with alt/title or text
  $('a[href], [class*="banner"], [class*="promo"], [class*="card"], [class*="item"]').each((_, el) => {
    const block = $(el);
    const href = block.attr('href') || block.find('a[href]').attr('href');
    if (!href) return;

    let title =
      block.find('h1, h2, h3, h4, h5, p, span, div[class*="title"]').first().text().replace(/\s+/g, ' ').trim() ||
      block.attr('title') ||
      block.find('img').attr('alt') ||
      block.attr('aria-label') ||
      '';

    let img =
      block.find('img').attr('src') ||
      block.find('img').attr('data-src') ||
      block.find('source').attr('srcset') ||
      null;

    title = title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]+>/g, '').trim();

    if (
      title.length > 5 &&
      !href.includes('tel:') &&
      !href.includes('mailto:') &&
      !href.includes('dia-chi-cua-hang') &&
      !href.includes('smember.com.vn/order') &&
      !href.includes('tuyendung') &&
      !href.includes('tos') &&
      !href.includes('privacy')
    ) {
      const url = href.startsWith('http') ? href : new URL(href, sourceUrl).toString();
      items.push({
        title,
        description: `Chương trình ${title} tại CellphoneS`,
        image: img ? (img.startsWith('http') ? img : new URL(img, sourceUrl).toString()) : null,
        url,
        score: 4,
      });
    }
  });

  // 2. Extract from Next.js payload
  const pushMatches = html.match(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g) || [];
  pushMatches.forEach((pm) => {
    const raw = pm.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    
    // Find all Objects containing alt / title / name AND src / desktop / mobile
    const promoObjs = raw.match(/\{[^{}]*?"(?:alt|title)":\s*"([^"]+)"[^{}]*?\}/g) || [];
    promoObjs.forEach((objText) => {
      const altMatch = objText.match(/"(?:alt|title)":\s*"([^"]+)"/);
      const linkMatch = objText.match(/"(?:href|link|url)":\s*"([^"]+)"/);
      const imgMatch = objText.match(/"(?:src|desktop|mobile|image|banner)":\s*"([^"]+)"/);

      if (altMatch) {
        const title = altMatch[1].trim();
        const href = linkMatch ? linkMatch[1] : sourceUrl;
        const img = imgMatch ? imgMatch[1] : null;

        if (
          title.length > 5 &&
          !title.includes('logo') &&
          !title.includes('social') &&
          !title.includes('QR') &&
          !title.includes('Hà Nội') &&
          !title.includes('Cần Thơ') &&
          !title.includes('Bình Dương')
        ) {
          const url = href.startsWith('http') ? href : new URL(href, sourceUrl).toString();
          items.push({
            title,
            description: `Khuyến mãi ${title}`,
            image: img ? (img.startsWith('http') ? img : new URL(img, sourceUrl).toString()) : null,
            url,
            score: 4,
          });
        }
      }
    });
  });

  // Deduplicate
  const seen = new Set();
  return items.filter((it) => {
    const key = `${it.title.toLowerCase()}|${it.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function test() {
  const html = fs.readFileSync('scratch/cps_page.html', 'utf8');
  const promos = extractCellphonesPromos(html, 'https://cellphones.com.vn/danh-sach-khuyen-mai');
  console.log('Extracted CellphoneS Promos:', promos.length);
  promos.slice(0, 20).forEach((p, idx) => {
    console.log(`${idx + 1}. [${p.title}]\n   URL: ${p.url}\n   Img: ${p.image}\n`);
  });
}

test();
