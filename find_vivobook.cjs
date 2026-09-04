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

async function run() {
  await AppDataSource.initialize();
  const events = await AppDataSource.query(`SELECT title, "eventDate", url FROM events WHERE title LIKE '%Vivobook%' OR title LIKE '%M3407KA%'`);
  console.log('Vivobook events in DB:', events);
  await AppDataSource.destroy();
}

run();
