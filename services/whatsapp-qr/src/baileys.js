const path = require('path');
const pino = require('pino');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const { pushInboundMessage } = require('./chatwoot');
const config = require('./config');

const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, '..', 'auth');
const RECONNECT_DELAY_MS = 3000;

const state = {
  // unconfigured | connecting | qr | connected | disconnected
  status: config.isConfigured() ? 'connecting' : 'unconfigured',
  qr: null,
  phoneNumber: null,
};

let sock = null;

const scheduleReconnect = () => {
  setTimeout(() => {
    start().catch(err => console.error('Failed to reconnect WhatsApp:', err));
  }, RECONNECT_DELAY_MS);
};

const extractText = message =>
  message.conversation ||
  message.extendedTextMessage?.text ||
  message.imageMessage?.caption ||
  message.videoMessage?.caption ||
  null;

const isRelevantIncomingMessage = msg => {
  if (!msg.message || msg.key.fromMe) return false;
  const jid = msg.key.remoteJid;
  if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') return false;
  return true;
};

async function handleIncomingMessages({ messages, type }) {
  if (type !== 'notify') return;

  for (const msg of messages) {
    if (!isRelevantIncomingMessage(msg)) continue;

    const phone = msg.key.remoteJid.split('@')[0];
    const name = msg.pushName || phone;
    const text = extractText(msg.message);
    if (!text) continue;

    try {
      // eslint-disable-next-line no-await-in-loop
      await pushInboundMessage(phone, name, text);
    } catch (err) {
      console.error('Failed to push inbound WhatsApp message to Chatwoot:', err.message);
    }
  }
}

async function handleConnectionUpdate(update) {
  const { connection, qr, lastDisconnect } = update;

  if (qr) {
    state.status = 'qr';
    state.qr = await QRCode.toDataURL(qr);
  }

  if (connection === 'open') {
    state.status = 'connected';
    state.qr = null;
    state.phoneNumber = sock.user?.id?.split(':')[0] || null;
  }

  if (connection === 'close') {
    state.status = 'disconnected';
    state.qr = null;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    if (statusCode === DisconnectReason.loggedOut) {
      state.phoneNumber = null;
    } else {
      scheduleReconnect();
    }
  }
}

async function start() {
  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: authState,
    logger: pino({ level: 'warn' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', handleConnectionUpdate);
  sock.ev.on('messages.upsert', handleIncomingMessages);
}

async function sendMessage(to, text) {
  if (!sock || state.status !== 'connected') {
    throw new Error('WhatsApp is not connected');
  }
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

async function logout() {
  if (sock) await sock.logout().catch(() => {});
  state.status = 'connecting';
  state.qr = null;
  state.phoneNumber = null;
  scheduleReconnect();
}

// Called once an inbox has been linked (see config.js). Safe to call more
// than once; only the first call actually opens a WhatsApp connection.
function startIfConfigured() {
  if (!config.isConfigured() || sock) return;
  start().catch(err => console.error('Failed to start WhatsApp connection:', err));
}

const getStatus = () => ({ ...state });

module.exports = { start, startIfConfigured, sendMessage, logout, getStatus };
