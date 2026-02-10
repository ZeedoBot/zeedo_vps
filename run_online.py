"""
Entrypoint para rodar o bot em modo online (persistência no Supabase).
Requer: SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_ANON_KEY) no .env
Equivalente a: BOT_STORAGE=supabase python bot.py
"""
import os
os.environ.setdefault("BOT_STORAGE", "supabase")

from bot import main

if __name__ == "__main__":
    main()
