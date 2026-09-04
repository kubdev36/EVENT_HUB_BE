const { DataSource } = require('typeorm');
const dotenv = require('dotenv');
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

function parsePublishedDate(text, referenceDate = new Date('2026-09-04T14:00:00Z')) {
  if (!text) return null;
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // 1. Check "ngày DD tháng MM (năm YYYY)"
  const vnTextDateMatch = cleanText.match(/(?:ngày\s+)?(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/i);
  if (vnTextDateMatch) {
    const [, dayStr, monthStr, yearStr] = vnTextDateMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = yearStr ? parseInt(yearStr, 10) : referenceDate.getFullYear();
      return new Date(year, month - 1, day, 9, 0);
    }
  }

  // 2. Check YYYY-MM-DD or YYYY/MM/DD
  const isoDateMatch = cleanText.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoDateMatch) {
    const [, yearStr, monthStr, dayStr] = isoDateMatch;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2030) {
      return new Date(year, month - 1, day, 9, 0);
    }
  }

  // 3. Check DD/MM/YYYY or DD-MM-YYYY
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

  // 4. Check DD/MM or DD-MM (Slash or Dash ONLY, NOT dot to prevent '6.9 inch' matching!)
  const shortDateMatch = cleanText.match(/\b(\d{1,2})[\/-](\d{1,2})\b(?!\s*(?:inch|in|cm|mm|kg|gb|mb|mp|hz|ghz|px|\"|'))/i);
  if (shortDateMatch) {
    const [, dayStr, monthStr] = shortDateMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const currentYear = referenceDate.getFullYear();
      let year = currentYear;
      if (month > referenceDate.getMonth() + 3) {
        year = currentYear - 1;
      }
      return new Date(year, month - 1, day, 9, 0);
    }
  }

  return null;
}

async function run() {
  await AppDataSource.initialize();
  console.log('Database connected!');

  const events = await AppDataSource.query(`SELECT id, title, description, url, "eventDate" FROM events`);
  console.log(`Checking ${events.length} events in DB...`);

  let updatedCount = 0;
  for (const ev of events) {
    const fullText = `${ev.title} ${ev.description || ''}`;
    const correctDate = parsePublishedDate(fullText);

    if (correctDate) {
      const oldStr = ev.eventDate ? new Date(ev.eventDate).toISOString().slice(0, 10) : 'null';
      const newStr = correctDate.toISOString().slice(0, 10);
      if (oldStr !== newStr) {
        console.log(`[FIX] Event ID ${ev.id}`);
        console.log(`      Title: ${ev.title}`);
        console.log(`      Old Date: ${oldStr} -> New Date: ${newStr}`);
        await AppDataSource.query(`UPDATE events SET "eventDate" = $1 WHERE id = $2`, [correctDate, ev.id]);
        updatedCount++;
      }
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} events with clean, accurate dates!`);
  await AppDataSource.destroy();
}

run().catch(err => console.error(err));
