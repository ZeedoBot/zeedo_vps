"""
Define o webhook do Telegram para receber /start e conectar usuários.
Execute uma vez após o deploy: python scripts/set_telegram_webhook.py
URL base: https://zeedo.ia.br/api (ajuste se diferente)
"""
import os
import sys

# Carrega .env
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _root)
from dotenv import load_dotenv
load_dotenv(os.path.join(_root, ".env"))

import requests

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BASE_URL = os.getenv("WEBHOOK_BASE_URL", "https://zeedo.ia.br/api")
WEBHOOK_URL = f"{BASE_URL.rstrip('/')}/webhooks/telegram"
# Opcional: se definido, o Telegram enviará este valor no header X-Telegram-Bot-Api-Secret-Token,
# validado pelo backend. Deve ser o mesmo valor de TELEGRAM_WEBHOOK_SECRET no .env do backend.
WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip()

def main():
    if not TOKEN:
        print("Erro: TELEGRAM_BOT_TOKEN não definido no .env")
        sys.exit(1)
    payload = {"url": WEBHOOK_URL}
    if WEBHOOK_SECRET:
        payload["secret_token"] = WEBHOOK_SECRET
    r = requests.post(
        f"https://api.telegram.org/bot{TOKEN}/setWebhook",
        json=payload,
        timeout=10
    )
    data = r.json()
    if data.get("ok"):
        print(f"Webhook configurado: {WEBHOOK_URL}")
    else:
        print(f"Erro: {data}")
        sys.exit(1)

if __name__ == "__main__":
    main()
