const fs = require('fs');
const path = require('path');

const CONFIG_DIR = process.env.AUTH_DIR || path.join(__dirname, '..', 'auth');
const CONFIG_FILE = path.join(CONFIG_DIR, 'inbox-config.json');

let current = null;

function load() {
  if (current) return current;

  try {
    current = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    current = null;
  }
  return current;
}

function save(inboxIdentifier, webhookSecret) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  current = { inboxIdentifier, webhookSecret };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(current), 'utf8');
  return current;
}

function isConfigured() {
  return Boolean(load());
}

module.exports = { load, save, isConfigured };
