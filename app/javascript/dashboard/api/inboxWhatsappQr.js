/* global axios */
import ApiClient from './ApiClient';

class InboxWhatsappQrAPI extends ApiClient {
  constructor() {
    super('inboxes', { accountScoped: true });
  }

  getStatus(inboxId) {
    return axios.get(`${this.url}/${inboxId}/whatsapp_qr`);
  }

  link(inboxId) {
    return axios.post(`${this.url}/${inboxId}/whatsapp_qr`);
  }

  logout(inboxId) {
    return axios.post(`${this.url}/${inboxId}/whatsapp_qr/logout`);
  }
}

export default new InboxWhatsappQrAPI();
