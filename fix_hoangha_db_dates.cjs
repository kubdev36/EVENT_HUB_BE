const { DataSource } = require('typeorm');
const dotenv = require('dotenv');
const https = require('https');
const http = require('http');
const cheerio = require('c:/Users/Gigabyte/OneDrive/MTM-Dev/Event-hubs/event_hub_be/node_modules/cheerio');
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'event_hub',
  synchronize: false,
});

function fetchWithRedirect(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchWithRedirect(new URL(res.headers.location, url).toString()));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function parsePublishedDate(text) {
  if (!text) return null;
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // Direct ISO
  if (cleanText.length >= 10 && (cleanText.includes('T') || cleanText.includes('Z') || cleanText.includes(','))) {
    const direct = new Date(cleanText);
    if (!Number.isNaN(direct.getTime())) return direct;
  }

  // Word months
  const vnWordMonths = [
    { text: 'tháng mười hai', month: 12 },
    { text: 'tháng mười một', month: 11 },
    { text: 'tháng mười', month: 10 },
    { text: 'tháng chín', month: 9 },
    { text: 'tháng tám', month: 8 },
    { text: 'tháng bảy', month: 7 },
    { text: 'tháng sáu', month: 6 },
    { text: 'tháng năm', month: 5 },
    { text: 'tháng tư', month: 4 },
    { text: 'tháng bốn', month: 4 },
    { text: 'tháng ba', month: 3 },
    { text: 'tháng hai', month: 2 },
    { text: 'tháng một', month: 1 },
  ];
  const lowerClean = cleanText.toLowerCase();
  for (const m of vnWordMonths) {
    if (lowerClean.includes(m.text)) {
      const match = lowerClean.match(new RegExp(`${m.text}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i')) ||
                    lowerClean.match(new RegExp(`(\\d{1,2})\\s+${m.text},?\\s+(\\d{4})`, 'i'));
      if (match) {
        const day = parseInt(match[1], 10);
        const year = parseInt(match[2], 10);
        if (day >= 1 && day <= 31 && year >= 2000 && year <= 2030) {
          return new Date(year, m.month - 1, day, 9, 0);
        }
      }
    }
  }

  // Full numeric date
  const fullDateMatch = cleanText.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
  if (fullDateMatch) {
    const [, dayStr, monthStr, yearStr] = fullDateMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2030) {
      return new Date(year, month - 1, day, 9, 0);
    }
  }

  return null;
}

async function run() {
  await AppDataSource.initialize();
  console.log('Database connected!');

  const events = await AppDataSource.query(`
    SELECT id, title, url, "eventDate", "sourceId"
    FROM events
    WHERE "sourceId" = 'hoangha' OR url LIKE '%hoanghamobile%'
  `);

  console.log(`Checking ${events.length} Hoang Ha Mobile events in DB...`);

  let updatedCount = 0;
  for (const ev of events) {
    if (!ev.url || !ev.url.startsWith('http')) continue;
    try {
      const html = await fetchWithRedirect(ev.url);
      if (!html) continue;
      const $ = cheerio.load(html);

      const dateStr =
        $('meta[property="article:published_time"]').attr('content') ||
        $('meta[name="pubdate"]').attr('content') ||
        $('time').first().text().trim() ||
        $('.post-date, .entry-date, .date, .time, .author-date').first().text().trim() ||
        null;

      if (dateStr) {
        const parsed = parsePublishedDate(dateStr);
        if (parsed) {
          const oldStr = ev.eventDate ? new Date(ev.eventDate).toISOString().slice(0, 10) : 'null';
          const newStr = parsed.toISOString().slice(0, 10);
          if (oldStr !== newStr) {
            console.log(`[FIX] ${ev.title.slice(0, 50)}...`);
            console.log(`      Old: ${oldStr} -> New: ${newStr}`);
            await AppDataSource.query(`UPDATE events SET "eventDate" = $1 WHERE id = $2`, [parsed, ev.id]);
            updatedCount++;
          }
        }
      }
    } catch (err) {
      console.error('Error fetching detail:', ev.url, err.message);
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} Hoang Ha events with their true detail page publication dates!`);
  await AppDataSource.destroy();
}

run();
