# 📦 Scripts de Deploy

Este diretório contém scripts auxiliares para facilitar o deploy do bot no VPS.

## 📋 Scripts Disponíveis

### `setup_vps.sh`
Script automatizado para configurar o VPS. Execute este script **no VPS** após transferir os arquivos do projeto.

**Uso:**
```bash
# No VPS, após transferir os arquivos:
cd ~/zeedo-bot
bash scripts/setup_vps.sh
```

**O que ele faz:**
- Atualiza o sistema
- Instala dependências (Python, pip, git, etc.)
- Configura firewall
- Cria ambiente virtual
- Instala dependências Python
- Configura Streamlit
- Cria serviços systemd para bot e dashboard

### `deploy_vps.sh`
Script de validação local (pode ser expandido no futuro).

## 🚀 Processo Completo de Deploy

### Passo 1: Preparar o Projeto Localmente

1. Certifique-se de que o arquivo `.env` está configurado
2. Teste localmente que tudo funciona

### Passo 2: Transferir para o VPS

**Opção A - Usando SCP (Windows PowerShell):**
```powershell
cd "C:\Users\pedro\Documents\Bot - Mainnet (V1)"
scp -r * zeedo@SEU_IP:~/zeedo-bot/
```

**Opção B - Usando Git:**
```bash
# No VPS:
git clone SEU_REPOSITORIO ~/zeedo-bot
```

**Opção C - Usando rsync (mais eficiente):**
```bash
rsync -avz --exclude '__pycache__' --exclude '*.pyc' \
  "C:/Users/pedro/Documents/Bot - Mainnet (V1)/" \
  zeedo@SEU_IP:~/zeedo-bot/
```

### Passo 3: Executar Setup no VPS

```bash
ssh zeedo@SEU_IP
cd ~/zeedo-bot
bash scripts/setup_vps.sh
```

### Passo 4: Configurar .env no VPS

```bash
nano ~/zeedo-bot/.env
# Cole suas variáveis de ambiente
chmod 600 ~/zeedo-bot/.env
```

### Passo 5: Iniciar Serviços

```bash
sudo systemctl start zeedo-bot.service
sudo systemctl start zeedo-dashboard.service

# Verificar status
sudo systemctl status zeedo-bot.service
sudo systemctl status zeedo-dashboard.service
```

### Passo 6: Acessar Dashboard

Abra no navegador: `http://SEU_IP:8501`

## 🔧 Comandos Úteis

### Gerenciar Serviços

```bash
# Iniciar
sudo systemctl start zeedo-bot.service
sudo systemctl start zeedo-dashboard.service

# Parar
sudo systemctl stop zeedo-bot.service
sudo systemctl stop zeedo-dashboard.service

# Reiniciar
sudo systemctl restart zeedo-bot.service
sudo systemctl restart zeedo-dashboard.service

# Ver status
sudo systemctl status zeedo-bot.service
sudo systemctl status zeedo-dashboard.service

# Ver logs
sudo journalctl -u zeedo-bot.service -f
sudo journalctl -u zeedo-dashboard.service -f
```

### Atualizar Código

```bash
cd ~/zeedo-bot

# Se usar Git:
git pull

# Reiniciar serviços
sudo systemctl restart zeedo-bot.service
sudo systemctl restart zeedo-dashboard.service
```

## ⚠️ Notas Importantes

1. **Segurança**: Configure autenticação no Streamlit ou use túnel SSH
2. **Backup**: Configure backups regulares dos arquivos `.json` e `.env`
3. **Monitoramento**: Monitore os logs regularmente
4. **Firewall**: Certifique-se de que apenas as portas necessárias estão abertas

## 📚 Documentação Completa

Para mais detalhes, consulte: `docs/GUIA_VPS_HETZNER.md`
