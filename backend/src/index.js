'use strict';

const app  = require('./app');
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`JamboCart backend running on http://localhost:${PORT}`);
});
