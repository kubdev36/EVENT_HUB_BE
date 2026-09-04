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
  console.log('Fixing Redmi 17 date in DB...');
  await AppDataSource.query(`
    UPDATE events
    SET "eventDate" = '2026-08-08 09:00:00'
    WHERE id = '8ae41558-b550-4139-b87a-8895e6635942'
  `);
  console.log('Done!');
  await AppDataSource.destroy();
}

run().catch(err => console.error(err));
