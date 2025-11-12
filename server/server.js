const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config(
    { path: path.resolve(__dirname, '../.env') }

);

const { sequelize } = require('./models'); // Import sequelize instance
const app = express();
const port = process.env.PORT || 5200;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));  // means any request whose path starts with /api/auth should be handled by routes/auth.js
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/studies', require('./routes/study'));

app.get('/', (req, res) => res.send('Backend ready with PostgreSQL!'));

sequelize.sync().then(() => { // Use { force: true } only in development, it drops existing tables!
  app.listen(port, () => console.log(`Server running on port ${port}`));
});
