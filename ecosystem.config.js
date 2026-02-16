/**
 * Configuração PM2 para o backend Zeedo.
 * Carrega variáveis do .env automaticamente.
 * Ajuste "cwd" conforme o caminho do projeto no seu VPS.
 */
module.exports = {
  apps: [
    {
      name: "zeedo-backend",
      script: "venv/bin/python",
      args: "-m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000",
      cwd: "/home/zeedo/zeedo_vps",
      env_file: ".env",
    },
  ],
};
