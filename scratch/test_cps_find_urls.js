const fs = require('fs');

function test() {
  const html = fs.readFileSync('scratch/cps_page.html', 'utf8');

  // Match all URLs or API endpoints inside HTML & Next.js hydration payload
  const urls = html.match(/https?:\/\/[^\s"'<>\\{}]+/gi) || [];
  const apiUrls = urls.filter((u) => u.includes('api') || u.includes('graphql') || u.includes('gateway') || u.includes('v2') || u.includes('v1') || u.includes('cellphones') || u.includes('cps'));

  console.log('Total unique URLs found:', new Set(urls).size);
  console.log('\nTop unique API/domain URLs:');
  const uniqueApi = [...new Set(apiUrls)];
  uniqueApi.slice(0, 30).forEach((u) => console.log('-', u));
}

test();
