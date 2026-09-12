class Api::V1::Accounts::InboxWhatsappQrController < Api::V1::Accounts::BaseController
  before_action :fetch_inbox
  before_action :ensure_api_channel

  # Proxies the WhatsApp connection status (and QR code, while pairing) from
  # the whatsapp-qr service. Kept server-side so the browser never needs
  # direct network access to that internal-only service or its shared secret.
  def show
    authorize @inbox, :show?

    render json: JSON.parse(RestClient.get("#{service_url}/status", api_key_headers).body)
  rescue Errno::ECONNREFUSED, RestClient::Exception, SocketError => e
    render json: { status: 'unreachable', error: e.message }, status: :bad_gateway
  end

  # Links this Api-channel inbox to the whatsapp-qr service so it knows where
  # to push inbound WhatsApp messages and how to verify outgoing webhooks.
  def create
    authorize @inbox, :update?

    body = { inbox_identifier: @inbox.channel.identifier, webhook_secret: @inbox.channel.secret }.to_json
    render json: JSON.parse(RestClient.post("#{service_url}/configure", body, api_key_headers.merge(content_type: :json)).body)
  rescue Errno::ECONNREFUSED, RestClient::Exception, SocketError => e
    render json: { error: e.message }, status: :bad_gateway
  end

  def logout
    authorize @inbox, :update?

    RestClient.post("#{service_url}/logout", {}, api_key_headers)
    head :ok
  rescue Errno::ECONNREFUSED, RestClient::Exception, SocketError => e
    render json: { error: e.message }, status: :bad_gateway
  end

  private

  def fetch_inbox
    @inbox = Current.account.inboxes.find(params[:inbox_id])
  end

  def ensure_api_channel
    return if @inbox.api?

    render json: { error: 'This endpoint is only available for API-channel inboxes' }, status: :unprocessable_entity
  end

  def service_url
    ENV.fetch('WHATSAPP_QR_SERVICE_URL', 'http://whatsapp_qr:3001')
  end

  def api_key_headers
    { 'X-Api-Key' => ENV.fetch('WHATSAPP_QR_SERVICE_KEY', '') }
  end
end
