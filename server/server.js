const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5200;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));  // means any request whose path starts with /api/auth should be handled by routes/auth.js

app.get('/', (req, res) => res.send('Backend ready with PostgreSQL!'));

app.listen(port, () => console.log(`Server running on port ${port}`));