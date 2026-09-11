class SuperAdmin::InstanceStatusesController < SuperAdmin::ApplicationController
  def show
    @metrics = {}
    chatwoot_version
    sha
    postgres_status
    redis_metrics
    chatwoot_edition
    instance_meta
  end

  def chatwoot_edition
    @metrics['Edição do Chatwoot'] = if ChatwootApp.enterprise?
                                       'Enterprise'
                                     elsif ChatwootApp.custom?
                                       'Custom'
                                     else
                                       'Community'
                                     end
  end

  def instance_meta
    migrations_paths = ActiveRecord::Migrator.migrations_paths
    migrations_context = ActiveRecord::MigrationContext.new(migrations_paths)
    @metrics['Migrações do Banco de Dados'] = migrations_context.needs_migration? ? 'pending' : 'completed'
  end

  def chatwoot_version
    @metrics['Versão do Chatwoot'] = Chatwoot.config[:version]
  end

  def sha
    @metrics['SHA do Git'] = GIT_HASH
  end

  def postgres_status
    @metrics['Postgres ativo'] = if ActiveRecord::Base.connection.active?
                                   'true'
                                 else
                                   'false'
                                 end
  end

  def redis_metrics
    r = Redis.new(Redis::Config.app)
    if r.ping == 'PONG'
      redis_server = r.info
      @metrics['Redis ativo'] = 'true'
      @metrics['Versão do Redis'] = redis_server['redis_version']
      @metrics['Número de clientes conectados ao Redis'] = redis_server['connected_clients']
      @metrics["Configuração 'maxclients' do Redis"] = redis_server['maxclients']
      @metrics['Memória usada pelo Redis'] = redis_server['used_memory_human']
      @metrics['Pico de memória do Redis'] = redis_server['used_memory_peak_human']
      @metrics['Memória total disponível para o Redis'] = redis_server['total_system_memory_human']
      @metrics["Configuração 'maxmemory' do Redis"] = redis_server['maxmemory']
      @metrics["Configuração 'maxmemory_policy' do Redis"] = redis_server['maxmemory_policy']
    end
  rescue Redis::CannotConnectError
    @metrics['Redis ativo'] = false
  end
end
