import os
import logging
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes
)

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

COMMUNITY_LINK = "https://t.me/+YXF26gnIg5U4MTc5"
TIKTOK_LINK = "https://www.tiktok.com/@zeedobot"

logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("💬 Comunidade", url=COMMUNITY_LINK)],
        [InlineKeyboardButton("🎵 TikTok", url=TIKTOK_LINK)]
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "🚀 Zeedo ON!\n\n"
        "Agora você receberá todas as notificações dos seus trades por aqui: Entradas, Parciais, Stops, PnL...\n\n"
        "Acesse nossa comunidade e fique por dentro dos conteúdos diários.",
        reply_markup=reply_markup
    )

def main():
    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))

    logging.info("🤖 Zeedo On ✅")
    app.run_polling()

if __name__ == "__main__":
    main()
