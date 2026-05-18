require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const payments = require('../routes/payments');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'jambocart-backend', port: PORT });
});

app.use('/api', payments);

app.listen(PORT, () => {
  console.log(`JamboCart backend running on http://localhost:${PORT}`);
});
