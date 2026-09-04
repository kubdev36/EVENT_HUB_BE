async function checkFptPublishedDate() {
  const url = 'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai/uu-dai-goi-dung-thu-google-ai-pro-6-thang-danh-cho-chu-so-huu-galaxy-z8-series-211719';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();

  // Check script tags for published date or createdAt
  const matches = html.match(/"(?:createdAt|publishedAt|publishDate|datePublished|created_at|published_time)":\s*"([^"]+)"/g);
  console.log('Published date matches in JSON/script:', matches);

  // Check author date snippet in HTML
  // In FPT articles: author name followed by date, e.g. "Trần Ngọc Mai", "08/08/2026" or similar
  const authorIdx = html.indexOf('Trần Ngọc Mai');
  if (authorIdx !== -1) {
    console.log('Snippet around author:', html.slice(authorIdx - 100, authorIdx + 300).replace(/<[^>]+>/g, ' '));
  }

  // Check JSON-LD
  const jsonLds = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  console.log('JSON LDs:', jsonLds);
}

checkFptPublishedDate();
