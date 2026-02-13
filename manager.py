"""
Entrypoint principal do SaaS multiusuário.
Roda o InstanceManager que gerencia todas as instâncias de usuários.
"""
import logging
import os
from dotenv import load_dotenv

# Configura logging básico
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%d-%b-%y %H:%M:%S'
)

# Desabilita logs HTTP
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("requests").setLevel(logging.WARNING)

load_dotenv()

# Força uso do Supabase
os.environ.setdefault("BOT_STORAGE", "supabase")

from manager.instance_manager import InstanceManager


def main():
    """Função principal."""
    logger = logging.getLogger("manager")
    logger.info("=" * 60)
    logger.info("Zeedo SaaS - Instance Manager")
    logger.info("=" * 60)
    
    try:
        manager = InstanceManager(check_interval=30)
        manager.start_monitoring()
    except KeyboardInterrupt:
        logger.info("Interrompido pelo usuário")
    except Exception as e:
        logger.error(f"Erro crítico: {e}", exc_info=True)
    finally:
        logger.info("Encerrando...")


if __name__ == "__main__":
    main()
