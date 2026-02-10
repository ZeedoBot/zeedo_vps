"""
Entrypoint para rodar o bot em modo local (persistência em JSON).
Equivalente a: BOT_STORAGE=local python bot.py
"""
import os
os.environ.setdefault("BOT_STORAGE", "local")

from bot import main

if __name__ == "__main__":
    main()
