class SuperAdmin::SettingsController < SuperAdmin::ApplicationController
  def show; end

  def refresh
    Internal::CheckNewVersionsJob.perform_now
    # rubocop:disable Rails/I18nLocaleTexts
    redirect_to super_admin_settings_path, notice: 'Status da instância atualizado'
    # rubocop:enable Rails/I18nLocaleTexts
  end
end
