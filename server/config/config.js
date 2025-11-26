const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const common = {
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    ...common,
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: (process.env.DB_NAME) + '_test',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    ...common,
  },
  production: process.env.DATABASE_URL
    ? {
        use_env_variable: 'DATABASE_URL',
        dialect: 'postgres',
        dialectOptions: {
          ssl: process.env.PGSSL === 'true' ? { require: true, rejectUnauthorized: false } : undefined,
        },
        logging: false,
      }
    : {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        ...common,
      },
};

