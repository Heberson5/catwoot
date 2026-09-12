const axios = require('axios');
const config = require('./config');

const BASE_URL = process.env.CHATWOOT_BASE_URL || 'http://rails:3000';

const toE164 = phone => (phone.startsWith('+') ? phone : `+${phone}`);

function client() {
  const { inboxIdentifier } = config.load() || {};
  if (!inboxIdentifier) throw new Error('WhatsApp inbox is not configured yet');

  return axios.create({
    baseURL: `${BASE_URL}/public/api/v1/inboxes/${inboxIdentifier}`,
    timeout: 10000,
  });
}

async function findOrCreateContact(phone, name) {
  await client().post('/contacts', {
    source_id: phone,
    name: name || phone,
    phone_number: toE164(phone),
  });
}

async function findOpenConversation(phone) {
  const { data } = await client().get(`/contacts/${phone}/conversations`);
  return data.find(conversation => conversation.status !== 'resolved') || null;
}

async function createConversation(phone) {
  const { data } = await client().post(`/contacts/${phone}/conversations`, {});
  return data;
}

async function sendIncomingMessage(phone, conversationId, content) {
  await client().post(`/contacts/${phone}/conversations/${conversationId}/messages`, { content });
}

// Pushes a message received on WhatsApp into Chatwoot as an incoming message,
// reusing the contact's currently open conversation or opening a new one.
async function pushInboundMessage(phone, name, content) {
  await findOrCreateContact(phone, name);
  const conversation = (await findOpenConversation(phone)) || (await createConversation(phone));
  await sendIncomingMessage(phone, conversation.id, content);
}

module.exports = { pushInboundMessage };
