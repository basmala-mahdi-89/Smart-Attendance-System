// Vercel Serverless catch-all entry — forwards every /api/* request to the Express app
const app = require('../src/app');

module.exports = app;
