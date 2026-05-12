const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'restaurant-finance-secret-key-2024',
  uploadDir: path.join(__dirname, 'uploads'),
  maxUploadSize: 10 * 1024 * 1024, // 10MB
  approvalTokenExpiryDays: 7,
  highAmountThreshold: 10000,
  databaseUrl: process.env.DATABASE_URL
};
