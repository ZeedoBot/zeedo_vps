"""
Telegram Sender - Envio manual de mensagens no Telegram.
Arquivo isolado, sem dependências do bot de trading.
Use para enviar mensagens de teste ou marketing manualmente.
"""
import os
import requests
from dotenv import load_dotenv

# Carrega .env do diretório do script ou do pai (raiz do projeto)
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(_SCRIPT_DIR + os.sep + ".env")
load_dotenv(os.path.join(_SCRIPT_DIR, "..", ".env"))

# Configurações (podem ser definidas no .env ou alteradas diretamente aqui)
TELEGRAM_BOT_TOKEN_SENDER = os.getenv("TELEGRAM_BOT_TOKEN_SENDER", "")
TELEGRAM_CHAT_ID_SENDER = os.getenv("TELEGRAM_CHAT_ID_SENDER", "")


def send_message(text: str) -> bool:
    """
    Envia uma mensagem de texto para o Telegram.

    Args:
        text: Texto a ser enviado (exatamente como recebido)

    Returns:
        True se enviado com sucesso, False caso contrário
    """
    if not TELEGRAM_BOT_TOKEN_SENDER:
        print("Erro: TELEGRAM_BOT_TOKEN_SENDER não configurado")
        return False
    if not TELEGRAM_CHAT_ID_SENDER:
        print("Erro: TELEGRAM_CHAT_ID_SENDER não configurado")
        return False
    if not text:
        print("Erro: Texto vazio")
        return False
    try:
        api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN_SENDER}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID_SENDER,
            "text": text,
            "parse_mode": "HTML",
        }
        response = requests.post(api_url, json=payload, timeout=10)
        response.raise_for_status()
        result = response.json()
        if result.get("ok"):
            print("✓ Mensagem enviada com sucesso")
            return True
        else:
            print(f"✗ Erro ao enviar: {result.get('description', 'Erro desconhecido')}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Erro de conexão: {e}")
        return False
    except Exception as e:
        print(f"✗ Erro inesperado: {e}")
        return False


if __name__ == "__main__":
    print("Telegram Sender - Teste de envio")
    print(f"Bot Token: {'***' + TELEGRAM_BOT_TOKEN_SENDER[-4:] if TELEGRAM_BOT_TOKEN_SENDER else 'NÃO CONFIGURADO'}")
    print(f"Chat ID: {TELEGRAM_CHAT_ID_SENDER if TELEGRAM_CHAT_ID_SENDER else 'NÃO CONFIGURADO'}")
    print()

    # Edite a mensagem e execute: python zeedo_pro/telegram_sender.py
    text_message = """🏁 TRADE ENCERRADO
LONG BTC
PnL TOTAL: +$24.60"""

    send_message(text_message)