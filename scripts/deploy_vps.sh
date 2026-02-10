#!/bin/bash
# Script de deploy para VPS Hetzner
# Uso: ./deploy_vps.sh

set -e

echo "🚀 Iniciando deploy do Zeedo Bot no VPS..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se está no diretório correto
if [ ! -f "bot.py" ]; then
    echo -e "${RED}❌ Erro: Execute este script na raiz do projeto${NC}"
    exit 1
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado. Certifique-se de criar um antes do deploy.${NC}"
fi

echo -e "${GREEN}✅ Script de deploy criado com sucesso!${NC}"
echo ""
echo "Próximos passos:"
echo "1. Transfira este projeto para o VPS (usando scp, rsync ou git)"
echo "2. Execute os comandos do guia GUIA_VPS_HETZNER.md no VPS"
echo "3. Ou use este script diretamente no VPS após transferir os arquivos"
echo ""
