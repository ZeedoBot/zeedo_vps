"""
Gerenciador de instâncias do bot multiusuário.
Monitora usuários ativos e gerencia processos de cada usuário.
"""
import time
import logging
import multiprocessing
from typing import Dict, Optional
from storage import get_storage


class InstanceManager:
    """
    Gerencia múltiplas instâncias do bot simultaneamente.
    Monitora usuários ativos e inicia/para instâncias conforme necessário.
    """
    
    def __init__(self, check_interval: int = 30):
        """
        Inicializa o gerenciador de instâncias.
        
        Args:
            check_interval: Intervalo em segundos para verificar usuários (padrão: 30s)
        """
        self.check_interval = check_interval
        self.active_instances: Dict[str, multiprocessing.Process] = {}
        self.instance_configs: Dict[str, dict] = {}  # Cache de configs para detectar mudanças
        self.storage = get_storage()
        self.logger = logging.getLogger("instance_manager")
        self.running = False
    
    def start_monitoring(self):
        """Inicia loop de monitoramento."""
        self.running = True
        self.logger.info("InstanceManager iniciado")
        
        try:
            while self.running:
                self._check_users()
                self._check_instance_health()
                self._update_heartbeats()
                time.sleep(self.check_interval)
        except KeyboardInterrupt:
            self.logger.info("InstanceManager recebeu sinal de parada")
        except Exception as e:
            self.logger.error(f"Erro no monitoramento: {e}", exc_info=True)
        finally:
            self.stop_all_instances()
    
    def stop_monitoring(self):
        """Para o monitoramento."""
        self.logger.info("Parando InstanceManager")
        self.running = False
    
    def _check_users(self):
        """Verifica usuários ativos e gerencia instâncias."""
        try:
            # Busca usuários ativos no banco
            active_users = self._get_active_users()
            
            for user_id in active_users:
                config = self._get_user_config(user_id)
                
                if not config:
                    continue
                
                bot_enabled = config.get('bot_enabled', False)
                is_running = user_id in self.active_instances
                
                if bot_enabled:
                    if not is_running:
                        # Inicia instância
                        self._start_instance(user_id, config)
                    elif self._config_changed(user_id, config):
                        # Config mudou, reinicia
                        self.logger.info(f"Config mudou para usuário {user_id}, reiniciando...")
                        self._restart_instance(user_id, config)
                else:
                    if is_running:
                        # Para instância
                        self.logger.info(f"Bot desabilitado para usuário {user_id}, parando...")
                        self._stop_instance(user_id)
        except Exception as e:
            self.logger.error(f"Erro ao verificar usuários: {e}", exc_info=True)
    
    def _get_active_users(self) -> list:
        """Busca usuários ativos no banco."""
        try:
            if hasattr(self.storage, '_client') and self.storage._client:
                # Busca usuários com bot_enabled = true
                r = self.storage._client.table("bot_config").select("user_id").eq("bot_enabled", True).execute()
                return [row.get('user_id') for row in (r.data or []) if row.get('user_id')]
            
            # Fallback: retorna lista vazia
            return []
        except Exception as e:
            self.logger.error(f"Erro ao buscar usuários ativos: {e}")
            return []
    
    def _get_user_config(self, user_id: str) -> Optional[dict]:
        """Busca configuração do usuário."""
        try:
            if hasattr(self.storage, '_client') and self.storage._client:
                r = self.storage._client.table("bot_config").select("*").eq("user_id", user_id).limit(1).execute()
                if r.data:
                    return r.data[0]
            return None
        except Exception as e:
            self.logger.error(f"Erro ao buscar config do usuário {user_id}: {e}")
            return None
    
    def _config_changed(self, user_id: str, new_config: dict) -> bool:
        """Verifica se a configuração mudou."""
        old_config = self.instance_configs.get(user_id)
        if not old_config:
            return False
        
        # Compara campos relevantes
        relevant_fields = ['symbols', 'timeframes', 'trade_mode', 'bot_enabled']
        for field in relevant_fields:
            if old_config.get(field) != new_config.get(field):
                return True
        
        return False
    
    def _start_instance(self, user_id: str, config: dict):
        """Inicia processo para um usuário."""
        try:
            if user_id in self.active_instances:
                self.logger.warning(f"Instância já está rodando para usuário {user_id}")
                return
            
            from instance.bot_instance import BotInstance
            
            # Cria função wrapper para o processo
            def run_instance():
                instance = BotInstance(user_id)
                instance.start()
            
            # Inicia processo
            process = multiprocessing.Process(target=run_instance, name=f"bot_user_{user_id}")
            process.start()
            
            self.active_instances[user_id] = process
            self.instance_configs[user_id] = config.copy()
            
            # Atualiza status no banco
            self._update_instance_status(user_id, 'running', process.pid)
            
            self.logger.info(f"Instância iniciada para usuário {user_id} (PID: {process.pid})")
        except Exception as e:
            self.logger.error(f"Erro ao iniciar instância para usuário {user_id}: {e}", exc_info=True)
            self._update_instance_status(user_id, 'error', None, str(e))
    
    def _stop_instance(self, user_id: str):
        """Para processo graciosamente."""
        try:
            if user_id not in self.active_instances:
                return
            
            process = self.active_instances[user_id]
            
            # Termina processo
            if process.is_alive():
                process.terminate()
                process.join(timeout=10)  # Aguarda até 10s
                
                if process.is_alive():
                    # Força se necessário
                    process.kill()
                    process.join()
            
            del self.active_instances[user_id]
            if user_id in self.instance_configs:
                del self.instance_configs[user_id]
            
            # Atualiza status no banco
            self._update_instance_status(user_id, 'stopped')
            
            self.logger.info(f"Instância parada para usuário {user_id}")
        except Exception as e:
            self.logger.error(f"Erro ao parar instância para usuário {user_id}: {e}", exc_info=True)
    
    def _restart_instance(self, user_id: str, config: dict):
        """Reinicia instância."""
        self._stop_instance(user_id)
        time.sleep(2)  # Pequeno delay antes de reiniciar
        self._start_instance(user_id, config)
    
    def _check_instance_health(self):
        """Verifica saúde das instâncias ativas."""
        dead_instances = []
        
        for user_id, process in list(self.active_instances.items()):
            if not process.is_alive():
                self.logger.warning(f"Processo morto detectado para usuário {user_id}")
                dead_instances.append(user_id)
        
        # Remove instâncias mortas
        for user_id in dead_instances:
            self._stop_instance(user_id)
            # Tenta reiniciar se bot ainda está habilitado
            config = self._get_user_config(user_id)
            if config and config.get('bot_enabled'):
                self.logger.info(f"Tentando reiniciar instância morta para usuário {user_id}")
                self._start_instance(user_id, config)
    
    def _update_heartbeats(self):
        """Atualiza heartbeats das instâncias ativas."""
        try:
            if hasattr(self.storage, '_client') and self.storage._client:
                from datetime import datetime
                for user_id, process in self.active_instances.items():
                    if process.is_alive():
                        self.storage._client.table("instance_status").upsert({
                            "user_id": user_id,
                            "status": "running",
                            "process_id": process.pid,
                            "last_heartbeat": datetime.utcnow().isoformat(),
                        }, on_conflict="user_id").execute()
        except Exception as e:
            self.logger.error(f"Erro ao atualizar heartbeats: {e}")
    
    def _update_instance_status(self, user_id: str, status: str, process_id: int = None, error_message: str = None):
        """Atualiza status da instância no banco."""
        try:
            if hasattr(self.storage, '_client') and self.storage._client:
                from datetime import datetime
                record = {
                    "user_id": user_id,
                    "status": status,
                    "last_heartbeat": datetime.utcnow().isoformat(),
                }
                
                if process_id is not None:
                    record["process_id"] = process_id
                
                if error_message:
                    record["error_message"] = error_message
                
                if status == "running" and "started_at" not in record:
                    record["started_at"] = datetime.utcnow().isoformat()
                elif status == "stopped":
                    record["stopped_at"] = datetime.utcnow().isoformat()
                
                self.storage._client.table("instance_status").upsert(
                    record,
                    on_conflict="user_id"
                ).execute()
        except Exception as e:
            self.logger.error(f"Erro ao atualizar status: {e}")
    
    def stop_all_instances(self):
        """Para todas as instâncias."""
        self.logger.info("Parando todas as instâncias...")
        for user_id in list(self.active_instances.keys()):
            self._stop_instance(user_id)
        self.logger.info("Todas as instâncias paradas")
