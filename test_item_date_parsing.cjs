const cheerio = require('c:/Users/Gigabyte/OneDrive/MTM-Dev/Event-hubs/event_hub_be/node_modules/cheerio');
const https = require('https');

function fetchHtml(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(null));
  });
}

function parseItemEventDate(item, referenceDate = new Date('2026-09-04T14:00:00Z')) {
  const text = `${item.title} ${item.description || ''}`.trim();
  const url = item.url || '';

  console.log('[parseItemEventDate] Input text:', text);

  // 1. Check explicit date match in text
  const explicitDateMatch = text.match(/(?:ngày\s+)?(\d{1,2})(?:\s*[-–—]\s*\d{1,2})?[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/i);
  if (explicitDateMatch) {
    console.log('[parseItemEventDate] explicitDateMatch found:', explicitDateMatch);
    const [, dayStr, monthStr, yearStr] = explicitDateMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const currentYear = referenceDate.getFullYear();
      let year = yearStr ? parseInt(yearStr.length === 2 ? '20' + yearStr : yearStr, 10) : currentYear;
      const d = new Date(year, month - 1, day, 9, 0);
      const diffDays = Math.abs((d.getTime() - referenceDate.getTime()) / (1000 * 3600 * 24));
      console.log(`[parseItemEventDate] Parsed date: ${d.toISOString()} (diffDays: ${diffDays})`);
      if (diffDays < 180) {
        return { date: d, time: '09:00' };
      }
    }
  }

  if (item.eventDate && !isNaN(item.eventDate.getTime())) {
    const isDummyNow = Math.abs(item.eventDate.getTime() - referenceDate.getTime()) < 5000;
    if (!isDummyNow) {
      console.log('[parseItemEventDate] Using item.eventDate:', item.eventDate.toISOString());
      return { date: item.eventDate, time: '09:00' };
    }
  }

  return { date: referenceDate, time: '09:00' };
}

async function run() {
  const url = 'https://www.thegioididong.com/tin-tuc/redmi-17-5g-redmi-17-4g-quoc-te-ra-mat-1596738';
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  // Extract page content as description or detail
  const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
  const h1Title = $('h1').text().trim();
  const subDateText = $('.timepost, .user_date, .date, span:contains("Huy Nguyễn"), div:contains("08/08")').text();

  console.log('--- EXTRACTED DETAIL PAGE DATA ---');
  console.log('H1 Title:', h1Title);
  console.log('Meta Desc:', metaDesc);
  console.log('SubDate Text:', subDateText);

  const item = {
    title: h1Title,
    description: metaDesc || subDateText,
    url,
  };

  const parsed = parseItemEventDate(item);
  console.log('\nResult date:', parsed.date ? parsed.date.toISOString() : 'NULL');
}

run();
