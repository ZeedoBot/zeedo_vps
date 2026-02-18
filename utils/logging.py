"""
Configuração de logging por usuário.
"""
import logging
import os
from logging.handlers import RotatingFileHandler


def setup_user_logger(user_id: str, log_dir: str = "logs") -> logging.Logger:
    """
    Cria logger isolado por usuário.
    
    Args:
        user_id: ID do usuário
        log_dir: Diretório para arquivos de log
    
    Returns:
        Logger configurado para o usuário
    """
    # Cria diretório se não existir
    os.makedirs(log_dir, exist_ok=True)
    
    # Cria logger específico do usuário (propagate=False evita duplicação no console)
    logger = logging.getLogger(f"bot.user_{user_id}")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    
    # Remove handlers existentes para evitar duplicação
    logger.handlers.clear()
    
    # Handler para arquivo específico do usuário
    log_file = os.path.join(log_dir, f"user_{user_id}.log")
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=5 * 1024 * 1024,  # 5MB
        backupCount=3,
        encoding='utf-8'
    )
    
    # Formatter com user_id
    formatter = logging.Formatter(
        f'[USER:{user_id}] %(asctime)s - %(message)s',
        datefmt='%d-%b-%y %H:%M:%S'
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Handler para console (opcional, pode remover em produção)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger
