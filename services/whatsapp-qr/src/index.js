const express = require('express');
const crypto = require('crypto');
const baileys = require('./baileys');
const config = require('./config');

const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3001;

const app = express();
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

function requireApiKey(req, res, next) {
  if (!API_KEY || req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

// Matches the HMAC scheme Chatwoot's WebhookJob signs API-channel webhooks
// with: sha256=HMAC-SHA256(secret, "{timestamp}.{raw body}").
function verifyChatwootSignature(req) {
  const { webhookSecret } = config.load() || {};
  const signature = req.headers['x-chatwoot-signature'];
  const timestamp = req.headers['x-chatwoot-timestamp'];
  if (!webhookSecret || !signature || !timestamp || !req.rawBody) return false;

  const expected = `sha256=${crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${req.rawBody}`)
    .digest('hex')}`;

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

async function handleChatwootWebhook(payload) {
  if (payload.event !== 'message_created') return;
  if (payload.message_type !== 'outgoing' || payload.private) return;

  const phone = payload.conversation?.contact_inbox?.source_id;
  const text = payload.content;
  if (!phone || !text) return;

  await baileys.sendMessage(phone, text);
}

app.get('/status', requireApiKey, (req, res) => {
  res.json(baileys.getStatus());
});

// Called once by Rails right after it creates the Api-channel inbox, so this
// service knows which inbox to push inbound messages into and which secret
// to verify outgoing-message webhooks against. Persisted to disk so it
// survives container restarts.
app.post('/configure', requireApiKey, (req, res) => {
  const { inbox_identifier: inboxIdentifier, webhook_secret: webhookSecret } = req.body || {};
  if (!inboxIdentifier || !webhookSecret) {
    return res.status(422).json({ error: 'inbox_identifier and webhook_secret are required' });
  }

  config.save(inboxIdentifier, webhookSecret);
  baileys.startIfConfigured();
  return res.json({ ok: true });
});

app.post('/logout', requireApiKey, async (req, res) => {
  await baileys.logout();
  res.json({ ok: true });
});

app.post('/send', requireApiKey, async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) {
    return res.status(422).json({ error: 'to and message are required' });
  }

  try {
    await baileys.sendMessage(to, message);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// Called by Chatwoot's Channel::Api webhook_url whenever an agent replies.
app.post('/webhook', (req, res) => {
  if (WEBHOOK_SECRET && !verifyChatwootSignature(req)) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  handleChatwootWebhook(req.body || {}).catch(err => {
    console.error('Failed to handle Chatwoot webhook:', err.message);
  });
  return res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`whatsapp-qr-service listening on port ${PORT}`);
});

// Reconnects automatically if this container restarts after an inbox was
// already linked in a previous run; otherwise waits for POST /configure.
baileys.startIfConfigured();
