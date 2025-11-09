const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const common = {
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || 'study_weave_db',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    ...common,
  },
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || null,
    database: (process.env.DB_NAME || 'study_weave_db') + '_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
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
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || null,
        database: process.env.DB_NAME || 'study_weave_db',
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        ...common,
      },
};

