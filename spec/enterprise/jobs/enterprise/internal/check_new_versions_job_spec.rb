require 'rails_helper'

RSpec.describe Internal::CheckNewVersionsJob do
  subject(:job) { described_class.perform_now }

  before do
    allow(Rails.env).to receive(:production?).and_return(true)
  end

  it 'does not update any plan info, since telemetry sync is disabled' do
    job
    expect(InstallationConfig.find_by(name: 'INSTALLATION_PRICING_PLAN')).to be_nil
  end
end
