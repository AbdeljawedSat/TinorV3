const mysql = require('mysql2/promise');
const { wrapMysqlPool } = require('./wrapPool');

const rawPool = mysql.createPool(
  process.env.DATABASE_URL || {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'tinor',
    password: process.env.DB_PASSWORD || 'tinor',
    database: process.env.DB_NAME || 'tinor_v3',
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
  }
);

module.exports = wrapMysqlPool(rawPool);
