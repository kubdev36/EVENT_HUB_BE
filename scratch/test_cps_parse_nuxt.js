const fs = require('fs');

function test() {
  const html = fs.readFileSync('scratch/cps_page.html', 'utf8');

  const items = [];

  // Regex match JSON objects inside self.__next_f.push
  // Extract all promotion items containing tab / title / banner / link / alt
  const jsonBlocks = html.match(/\{[^{}]*"bannerUd"[^{}]*\}/g) || [];
  console.log('Found bannerUd JSON blocks count:', jsonBlocks.length);

  // Or extract all links, titles, images inside Next.js payload
  const pushMatches = html.match(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g) || [];
  console.log('Found __next_f.push count:', pushMatches.length);

  pushMatches.forEach((pm) => {
    // Unescape Next.js escaped JSON string
    const raw = pm.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    
    // Find all promotion titles and banners
    const promoMatches = raw.match(/"title":"([^"]+)".*?"(http[^"]+\.(?:png|jpg|jpeg|webp))"/gi) || [];
    
    // Find objects with "alt", "desktop", "link", "title"
    const matches = raw.match(/\{[^{}]*"title":\s*"([^"]+)"[^{}]*\}/gi) || [];
    matches.forEach((m) => {
      try {
        if (m.includes('http') || m.includes('link') || m.includes('alt')) {
          console.log('Promo match:', m.slice(0, 200));
        }
      } catch {}
    });
  });

  // Let's also extract any img with alt text inside the HTML or Next.js payload
  const imgAltMatches = html.match(/"alt":"([^"]+)".*?"(?:desktop|mobile|src|image)":"([^"]+)"/gi) || [];
  console.log('Found imgAltMatches count:', imgAltMatches.length);
  imgAltMatches.slice(0, 15).forEach((m, idx) => console.log(`${idx + 1}.`, m));
}

test();
