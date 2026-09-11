import ApiClient from './ApiClient';

class ChangelogApi extends ApiClient {
  constructor() {
    super('changelog', { apiVersion: 'v1' });
  }

  // Outbound fetch to Chatwoot's own changelog hub has been disabled for this self-hosted fork.
  // eslint-disable-next-line class-methods-use-this
  fetchFromHub() {
    return Promise.resolve({ data: { posts: [] } });
  }
}

export default new ChangelogApi();
