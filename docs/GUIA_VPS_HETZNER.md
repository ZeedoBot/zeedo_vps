# 🚀 Guia Completo: Configuração de VPS Hetzner para o Bot Zeedo

Este guia vai te ajudar a configurar um VPS da Hetzner para rodar seu bot de trading e dashboard Streamlit 24/7.

## 📋 Índice
1. [Criar e Configurar o VPS](#1-criar-e-configurar-o-vps)
2. [Configuração Inicial do Servidor](#2-configuração-inicial-do-servidor)
3. [Instalar Dependências](#3-instalar-dependências)
4. [Transferir o Projeto](#4-transferir-o-projeto)
5. [Configurar Variáveis de Ambiente](#5-configurar-variáveis-de-ambiente)
6. [Rodar o Bot em Background](#6-rodar-o-bot-em-background)
7. [Rodar o Dashboard Streamlit](#7-rodar-o-dashboard-streamlit)
8. [Gerenciar Processos com systemd](#8-gerenciar-processos-com-systemd)
9. [Monitoramento e Manutenção](#9-monitoramento-e-manutenção)

---

## 1. Criar e Configurar o VPS

### 1.1. Criar o VPS na Hetzner

1. Acesse [console.hetzner.cloud](https://console.hetzner.cloud)
2. Clique em **"Add Server"**
3. Escolha:
   - **Imagem**: Ubuntu 22.04 ou 24.04 LTS
   - **Tipo**: CPX11 (2 vCPU, 4GB RAM) ou superior (recomendado CPX21 para mais recursos)
   - **Localização**: Escolha a mais próxima (Falkenstein, Nuremberg, ou Helsinki)
   - **SSH Key**: Adicione sua chave SSH (recomendado) ou use senha
4. Clique em **"Create & Buy Now"**

### 1.2. Conectar ao VPS

**Windows (PowerShell):**
```powershell
ssh root@SEU_IP_DO_VPS
```

**Ou usando chave SSH:**
```powershell
ssh -i caminho/para/sua/chave.pem root@SEU_IP_DO_VPS
```

---

## 2. Configuração Inicial do Servidor

### 2.1. Atualizar o Sistema

```bash
apt update && apt upgrade -y
```

### 2.2. Criar Usuário Não-Root (Recomendado)

```bash
# Criar usuário
adduser zeedo
usermod -aG sudo zeedo

# Adicionar ao grupo docker (se for usar Docker)
usermod -aG docker zeedo

# Mudar para o usuário
su - zeedo
```

### 2.3. Configurar Firewall (UFW)

```bash
# Instalar UFW
sudo apt install ufw -y

# Permitir SSH
sudo ufw allow 22/tcp

# Permitir porta do Streamlit (padrão 8501)
sudo ufw allow 8501/tcp

# Ativar firewall
sudo ufw enable

# Verificar status
sudo ufw status
```

---

## 3. Instalar Dependências

### 3.1. Instalar Python e pip

```bash
sudo apt install python3 python3-pip python3-venv -y
```

### 3.2. Instalar Git (para clonar repositório)

```bash
sudo apt install git -y
```

### 3.3. Instalar Outras Ferramentas Úteis

```bash
sudo apt install htop nano curl wget screen tmux -y
```

---

## 4. Transferir o Projeto

### Opção A: Usar Git (Recomendado)

```bash
# Criar diretório para o projeto
mkdir -p ~/zeedo-bot
cd ~/zeedo-bot

# Se você tem o projeto em um repositório Git:
git clone SEU_REPOSITORIO_GIT .

# Ou criar manualmente e transferir arquivos
```

### Opção B: Transferir via SCP (do seu Windows)

**No PowerShell do Windows:**
```powershell
# Navegar até a pasta do projeto
cd "C:\Users\pedro\Documents\Bot - Mainnet (V1)"

# Transferir todos os arquivos
scp -r * zeedo@SEU_IP_DO_VPS:~/zeedo-bot/
```

### Opção C: Usar rsync (mais eficiente)

**No PowerShell do Windows (com WSL ou Git Bash):**
```bash
rsync -avz --exclude '__pycache__' --exclude '*.pyc' \
  "C:/Users/pedro/Documents/Bot - Mainnet (V1)/" \
  zeedo@SEU_IP_DO_VPS:~/zeedo-bot/
```

### 4.1. Criar Ambiente Virtual

```bash
cd ~/zeedo-bot
python3 -m venv venv
source venv/bin/activate
```

### 4.2. Instalar Dependências Python

```bash
pip install --upgrade pip
pip install -r requirements.txt

# Instalar dependências adicionais necessárias
pip install streamlit hyperliquid-python-sdk psutil
```

---

## 5. Configurar Variáveis de Ambiente

### 5.1. Criar arquivo .env

```bash
nano ~/zeedo-bot/.env
```

### 5.2. Adicionar suas variáveis (copie do seu .env local):

```env
# Hyperliquid
HYPER_PRIVATE_KEY=sua_chave_privada_aqui
HYPER_ACCOUNT_ADDRESS=seu_endereco_aqui

# Telegram
TELEGRAM_BOT_TOKEN=seu_token_aqui
TELEGRAM_CHAT_ID=seu_chat_id_aqui

# Supabase (se estiver usando)
SUPABASE_URL=sua_url_supabase
SUPABASE_SERVICE_KEY=sua_service_key
# ou
SUPABASE_ANON_KEY=sua_anon_key

# Storage (opcional - padrão é 'local')
BOT_STORAGE=supabase
```

**Salvar:** `Ctrl+O`, `Enter`, `Ctrl+X`

### 5.3. Proteger o arquivo .env

```bash
chmod 600 ~/zeedo-bot/.env
```

---

## 6. Rodar o Bot em Background

### Opção A: Usar screen (Simples)

```bash
# Criar sessão screen
screen -S zeedo-bot

# Ativar ambiente virtual e rodar
cd ~/zeedo-bot
source venv/bin/activate
python bot.py

# Desconectar: Ctrl+A, depois D
# Reconectar: screen -r zeedo-bot
```

### Opção B: Usar tmux (Alternativa)

```bash
# Criar sessão tmux
tmux new -s zeedo-bot

# Ativar ambiente virtual e rodar
cd ~/zeedo-bot
source venv/bin/activate
python bot.py

# Desconectar: Ctrl+B, depois D
# Reconectar: tmux attach -t zeedo-bot
```

### Opção C: Usar nohup (Mais simples, mas menos controle)

```bash
cd ~/zeedo-bot
source venv/bin/activate
nohup python bot.py > bot.log 2>&1 &
```

---

## 7. Rodar o Dashboard Streamlit

### 7.1. Configurar Streamlit para acesso externo

```bash
# Criar diretório de configuração
mkdir -p ~/.streamlit

# Criar arquivo de configuração
nano ~/.streamlit/config.toml
```

**Adicionar:**
```toml
[server]
headless = true
port = 8501
address = "0.0.0.0"
enableCORS = false
enableXsrfProtection = false
```

### 7.2. Rodar o Dashboard

**Com screen:**
```bash
screen -S zeedo-dashboard
cd ~/zeedo-bot
source venv/bin/activate
streamlit run dashboard.py
```

**Ou com nohup:**
```bash
cd ~/zeedo-bot
source venv/bin/activate
nohup streamlit run dashboard.py > dashboard.log 2>&1 &
```

### 7.3. Acessar o Dashboard

Abra no navegador:
```
http://SEU_IP_DO_VPS:8501
```

**⚠️ IMPORTANTE:** Configure autenticação ou use um túnel SSH para segurança!

---

## 8. Gerenciar Processos com systemd (Recomendado)

### 8.1. Criar serviço para o Bot

```bash
sudo nano /etc/systemd/system/zeedo-bot.service
```

**Adicionar:**
```ini
[Unit]
Description=Zeedo Trading Bot
After=network.target

[Service]
Type=simple
User=zeedo
WorkingDirectory=/home/zeedo/zeedo-bot
Environment="PATH=/home/zeedo/zeedo-bot/venv/bin"
ExecStart=/home/zeedo/zeedo-bot/venv/bin/python /home/zeedo/zeedo-bot/bot.py
Restart=always
RestartSec=10
StandardOutput=append:/home/zeedo/zeedo-bot/bot.log
StandardError=append:/home/zeedo/zeedo-bot/bot_error.log

[Install]
WantedBy=multi-user.target
```

### 8.2. Criar serviço para o Dashboard

```bash
sudo nano /etc/systemd/system/zeedo-dashboard.service
```

**Adicionar:**
```ini
[Unit]
Description=Zeedo Dashboard Streamlit
After=network.target

[Service]
Type=simple
User=zeedo
WorkingDirectory=/home/zeedo/zeedo-bot
Environment="PATH=/home/zeedo/zeedo-bot/venv/bin"
ExecStart=/home/zeedo/zeedo-bot/venv/bin/streamlit run /home/zeedo/zeedo-bot/dashboard.py --server.port=8501 --server.address=0.0.0.0
Restart=always
RestartSec=10
StandardOutput=append:/home/zeedo/zeedo-bot/dashboard.log
StandardError=append:/home/zeedo/zeedo-bot/dashboard_error.log

[Install]
WantedBy=multi-user.target
```

### 8.3. Ativar e Iniciar os Serviços

```bash
# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar para iniciar no boot
sudo systemctl enable zeedo-bot.service
sudo systemctl enable zeedo-dashboard.service

# Iniciar os serviços
sudo systemctl start zeedo-bot.service
sudo systemctl start zeedo-dashboard.service

# Verificar status
sudo systemctl status zeedo-bot.service
sudo systemctl status zeedo-dashboard.service
```

### 8.4. Comandos Úteis do systemd

```bash
# Parar serviço
sudo systemctl stop zeedo-bot.service

# Iniciar serviço
sudo systemctl start zeedo-bot.service

# Reiniciar serviço
sudo systemctl restart zeedo-bot.service

# Ver logs
sudo journalctl -u zeedo-bot.service -f
sudo journalctl -u zeedo-dashboard.service -f

# Ver últimas 100 linhas
sudo journalctl -u zeedo-bot.service -n 100
```

---

## 9. Monitoramento e Manutenção

### 9.1. Verificar Processos

```bash
# Ver processos Python rodando
ps aux | grep python

# Ver uso de recursos
htop

# Ver espaço em disco
df -h
```

### 9.2. Ver Logs

```bash
# Logs do bot
tail -f ~/zeedo-bot/bot_trades.log

# Logs do systemd
sudo journalctl -u zeedo-bot.service -f

# Logs do dashboard
tail -f ~/zeedo-bot/dashboard.log
```

### 9.3. Atualizar o Código

```bash
cd ~/zeedo-bot

# Se usar Git:
git pull

# Reiniciar serviços
sudo systemctl restart zeedo-bot.service
sudo systemctl restart zeedo-dashboard.service
```

### 9.4. Backup Regular

```bash
# Criar script de backup
nano ~/backup-zeedo.sh
```

**Adicionar:**
```bash
#!/bin/bash
BACKUP_DIR="/home/zeedo/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup dos arquivos de dados
tar -czf $BACKUP_DIR/zeedo-data-$DATE.tar.gz \
  ~/zeedo-bot/*.json \
  ~/zeedo-bot/*.log \
  ~/zeedo-bot/.env

# Manter apenas últimos 7 backups
ls -t $BACKUP_DIR/zeedo-data-*.tar.gz | tail -n +8 | xargs rm -f

echo "Backup criado: $BACKUP_DIR/zeedo-data-$DATE.tar.gz"
```

**Tornar executável e agendar:**
```bash
chmod +x ~/backup-zeedo.sh

# Agendar para rodar diariamente às 3h da manhã
crontab -e
# Adicionar linha:
0 3 * * * /home/zeedo/backup-zeedo.sh
```

---

## 🔒 Segurança Adicional

### 10.1. Configurar Autenticação no Streamlit

Crie `~/.streamlit/credentials.toml`:
```toml
[general]
email = "seu_email@exemplo.com"
```

E configure no `config.toml`:
```toml
[server]
headless = true
port = 8501
address = "0.0.0.0"
enableCORS = false
enableXsrfProtection = true
```

### 10.2. Usar Túnel SSH (Mais Seguro)

**No seu Windows:**
```powershell
ssh -L 8501:localhost:8501 zeedo@SEU_IP_DO_VPS
```

Depois acesse `http://localhost:8501` no navegador.

### 10.3. Configurar Nginx como Proxy Reverso (Opcional)

```bash
sudo apt install nginx -y

sudo nano /etc/nginx/sites-available/zeedo-dashboard
```

**Adicionar:**
```nginx
server {
    listen 80;
    server_name SEU_DOMINIO_OU_IP;

    location / {
        proxy_pass http://localhost:8501;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Ativar:**
```bash
sudo ln -s /etc/nginx/sites-available/zeedo-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## ✅ Checklist Final

- [ ] VPS criado e acessível via SSH
- [ ] Sistema atualizado
- [ ] Python e dependências instaladas
- [ ] Projeto transferido para o VPS
- [ ] Arquivo .env configurado com suas credenciais
- [ ] Ambiente virtual criado e dependências instaladas
- [ ] Bot rodando e funcionando
- [ ] Dashboard acessível
- [ ] Serviços systemd configurados (opcional mas recomendado)
- [ ] Firewall configurado
- [ ] Backup configurado

---

## 🆘 Troubleshooting

### Bot não inicia
```bash
# Verificar logs
sudo journalctl -u zeedo-bot.service -n 50

# Verificar se .env está correto
cat ~/zeedo-bot/.env

# Testar manualmente
cd ~/zeedo-bot
source venv/bin/activate
python bot.py
```

### Dashboard não acessível
```bash
# Verificar se está rodando
ps aux | grep streamlit

# Verificar porta
sudo netstat -tlnp | grep 8501

# Verificar firewall
sudo ufw status

# Verificar logs
sudo journalctl -u zeedo-dashboard.service -n 50
```

### Erro de permissão
```bash
# Verificar propriedade dos arquivos
ls -la ~/zeedo-bot

# Corrigir se necessário
sudo chown -R zeedo:zeedo ~/zeedo-bot
```

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs primeiro
2. Teste manualmente antes de usar systemd
3. Verifique se todas as variáveis de ambiente estão corretas
4. Certifique-se de que o firewall permite as portas necessárias

---

**Boa sorte com seu bot! 🚀**
