const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config(
    { path: path.resolve(__dirname, '../.env') }

);

const { sequelize } = require('./models'); // Import sequelize instance
const app = express();
const port = process.env.PORT || 5200;
const BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '25mb';

// Middleware
app.use(cors());
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// Routes
app.use('/api/auth', require('./routes/auth'));  // means any request whose path starts with /api/auth should be handled by routes/auth.js
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/studies', require('./routes/study'));
app.use('/api/artifacts', require('./routes/artifacts'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/researcher', require('./routes/researcher'));
app.use('/api/reviewer', require('./routes/reviewer'));
app.use('/api/competency', require('./routes/competency'));
app.use('/api/llm', require('./routes/llm'));
app.use('/api/artifact-assessments', require('./routes/artifactAssessments'));
app.use('/api/participant', require('./routes/participant'));

app.get('/', (req, res) => res.send('Backend ready with PostgreSQL!'));

sequelize.sync({ force: false }).then(() => { // Use { force: true } only in development, it drops existing tables!
  app.listen(port, () => console.log(`Server running on port ${port}`));
});
