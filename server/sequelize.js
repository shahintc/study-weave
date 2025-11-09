const { Sequelize } = require('sequelize');
require('dotenv').config();

const useUrl = !!process.env.DATABASE_URL;

const sequelize = useUrl
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
    })
  : new Sequelize(
      process.env.DB_NAME || 'study_weave_db',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || null,
      {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        dialect: 'postgres',
        logging: false,
      }
    );

module.exports = sequelize;

