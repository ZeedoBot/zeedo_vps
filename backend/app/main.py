"""
API do dashboard SaaS.
Rodar na raiz do projeto: uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
Ou de backend/: PYTHONPATH=.. uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routes import auth, wallet, telegram, bot

app = FastAPI(
    title="Zeedo Dashboard API",
    description="API para o dashboard SaaS do bot Zeedo",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(wallet.router)
app.include_router(telegram.router)
app.include_router(bot.router)


@app.get("/")
def root():
    return {"service": "Zeedo Dashboard API", "docs": "/docs"}
