const fs = require('fs');

function test() {
  const html = fs.readFileSync('scratch/cps_page.html', 'utf8');

  // Search for any link or string containing uu-dai or doi-tac or hsbc or homecredit or nam-a or student
  const matches = html.match(/href=["']([^"']*(?:uu-dai|doi-tac|khuyen-mai|smember|tra-gop|student|b2s|hsbc)[^"']*)["']/gi) || [];
  console.log('Found href matches count:', matches.length);
  matches.forEach((m) => console.log(' ->', m));

  // Search for any alt / src in img tags
  const imgMatches = html.match(/<img[^>]+alt=["']([^"']+)["'][^>]*>/gi) || [];
  console.log('\nFound img with alt count:', imgMatches.length);
  imgMatches.forEach((img) => console.log(' ->', img));
}

test();
