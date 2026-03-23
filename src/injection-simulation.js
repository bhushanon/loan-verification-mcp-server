const express = require('express');
const db = require('./db');
const router = express.Router();

// SQL injection vulnerability
router.get('/user', async (req, res) => {
  const id = req.query.id;
  const user = await db.query('SELECT * FROM users WHERE id = ' + id);
  res.json(user);
});

// Hardcoded secret
const API_KEY = "sk-prod-abc123supersecret";

// Weak hash
const crypto = require('crypto');
const hash = crypto.createHash('md5').update(password).digest('hex');

module.exports = router;
