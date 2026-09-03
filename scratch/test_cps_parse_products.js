const fs = require('fs');

function test() {
  const html = fs.readFileSync('scratch/cps_page.html', 'utf8');

  // Search for paymentPromotionConfig or banner object inside Next.js payload
  const matches = html.match(/paymentPromotionConfig[\s\S]*?\}\}\}/gi) || [];
  console.log('paymentPromotionConfig matches:', matches.length);

  matches.forEach((m, idx) => {
    console.log(`\nMatch #${idx + 1}:`, m.slice(0, 500));
  });

  // Search for any occurrence of link with alt / title in Next.js payload
  const jsonBlocks = html.match(/\{[^{}]*"link":[^{}]*\}/g) || [];
  console.log('\nTotal json blocks with link:', jsonBlocks.length);
  jsonBlocks.slice(0, 15).forEach((b) => console.log('-', b));
}

test();
