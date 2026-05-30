#!/bin/bash
# Script para configurar o VPS automaticamente
# Execute no VPS após transferir os arquivos do projeto
# Uso: bash setup_vps.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Configurando VPS para Zeedo Bot...${NC}"

# Verificar se está rodando como root ou com sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  Alguns comandos precisam de sudo. Você pode precisar inserir sua senha.${NC}"
fi

# 1. Atualizar sistema
echo -e "${GREEN}[1/8] Atualizando sistema...${NC}"
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependências básicas
echo -e "${GREEN}[2/8] Instalando dependências...${NC}"
sudo apt install -y python3 python3-pip python3-venv git htop nano curl wget ufw

# 3. Configurar firewall
echo -e "${GREEN}[3/8] Configurando firewall...${NC}"
sudo ufw allow 22/tcp
sudo ufw allow 8501/tcp
sudo ufw --force enable

# 4. Criar ambiente virtual
echo -e "${GREEN}[4/8] Criando ambiente virtual...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

# 5. Instalar dependências Python
echo -e "${GREEN}[5/8] Instalando dependências Python...${NC}"
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo -e "${YELLOW}⚠️  requirements.txt não encontrado. Instalando dependências básicas...${NC}"
    pip install numpy pandas python-dotenv eth-account requests streamlit "hyperliquid-python-sdk>=0.23.0" psutil supabase
fi

# 6. Configurar Streamlit
echo -e "${GREEN}[6/8] Configurando Streamlit...${NC}"
mkdir -p ~/.streamlit
cat > ~/.streamlit/config.toml << EOF
[server]
headless = true
port = 8501
address = "0.0.0.0"
enableCORS = false
enableXsrfProtection = false
EOF

# 7. Criar serviços systemd
echo -e "${GREEN}[7/8] Criando serviços systemd...${NC}"

# Obter caminho absoluto do projeto
PROJECT_DIR=$(pwd)
USER=$(whoami)

# Criar serviço do bot
sudo tee /etc/systemd/system/zeedo-bot.service > /dev/null << EOF
[Unit]
Description=Zeedo Trading Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$PROJECT_DIR/venv/bin"
ExecStart=$PROJECT_DIR/venv/bin/python $PROJECT_DIR/bot.py
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_DIR/bot.log
StandardError=append:$PROJECT_DIR/bot_error.log

[Install]
WantedBy=multi-user.target
EOF

# Criar serviço do dashboard
sudo tee /etc/systemd/system/zeedo-dashboard.service > /dev/null << EOF
[Unit]
Description=Zeedo Dashboard Streamlit
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$PROJECT_DIR/venv/bin"
ExecStart=$PROJECT_DIR/venv/bin/streamlit run $PROJECT_DIR/dashboard.py --server.port=8501 --server.address=0.0.0.0
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_DIR/dashboard.log
StandardError=append:$PROJECT_DIR/dashboard_error.log

[Install]
WantedBy=multi-user.target
EOF

# 8. Recarregar e habilitar serviços
echo -e "${GREEN}[8/8] Configurando serviços...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable zeedo-bot.service
sudo systemctl enable zeedo-dashboard.service

echo ""
echo -e "${GREEN}✅ Configuração concluída!${NC}"
echo ""
echo "Próximos passos:"
echo "1. Certifique-se de que o arquivo .env está configurado corretamente"
echo "2. Inicie os serviços com:"
echo "   sudo systemctl start zeedo-bot.service"
echo "   sudo systemctl start zeedo-dashboard.service"
echo "3. Verifique o status com:"
echo "   sudo systemctl status zeedo-bot.service"
echo "   sudo systemctl status zeedo-dashboard.service"
echo "4. Acesse o dashboard em: http://SEU_IP:8501"
echo ""
