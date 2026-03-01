# 🎓 Área de Membros - Curso Zeedo

## 📌 Resumo

Foi criada uma área de membros completa estilo **Netflix/Kiwify** para hospedar o curso introdutório do Zeedo.

## 🎯 Funcionalidades

✅ **Página principal** (`/dashboard/curso`)
- Grid de aulas com thumbnails
- Barra de progresso geral
- Badge de aulas concluídas
- Design responsivo

✅ **Página de aula** (`/dashboard/curso/[id]`)
- Player de vídeo embedado (Vimeo)
- Navegação anterior/próxima
- Botão "Marcar como concluída"
- Lista de todas as aulas

✅ **Sistema de progresso**
- Salva progresso no banco de dados
- Calcula porcentagem de conclusão
- Mostra certificado ao completar 100%

## 🚀 Como usar

### 1. Executar migration no Supabase
```sql
-- Execute o arquivo: migrations/014_course_progress.sql
```

### 2. Fazer upload dos vídeos no Vimeo
- Crie conta grátis: https://vimeo.com
- Faça upload dos 7 vídeos (3-4 por semana)
- Configure privacidade para `zeedo.ia.br`

### 3. Adicionar links dos vídeos
```sql
UPDATE course_lessons 
SET video_url = 'https://player.vimeo.com/video/SEU_ID'
WHERE id = 1;
```

### 4. Deploy
```bash
# Backend
pm2 restart zeedo-backend

# Frontend
cd /home/zeedo/zeedo_vps/frontend
npm run build
pm2 restart zeedo-frontend
```

## 📚 Aulas pré-cadastradas

1. Bem-vindo ao Zeedo (5:00)
2. Configurando sua Conta (5:30)
3. Entendendo os Sinais (6:00)
4. Gerenciamento de Risco (5:45)
5. Configurações Avançadas (4:30)
6. Análise de Resultados (5:15)
7. Melhores Práticas (4:45)

## 📖 Documentação completa

Veja `INSTRUCOES_CURSO.md` para instruções detalhadas.

## 🎬 Hospedagem de vídeos

**Recomendado: Vimeo grátis**
- ✅ 500 MB/semana (suficiente para 3-4 vídeos)
- ✅ 5 GB total (suficiente para os 7 vídeos)
- ✅ Proteção de domínio
- ✅ Player profissional
- ✅ Sem anúncios

**Alternativa: YouTube (não listado)**
- ✅ Grátis e ilimitado
- ❌ Menos profissional
- ❌ Qualquer um com link pode ver

## 🔗 Links úteis

- Vimeo: https://vimeo.com
- Supabase: https://supabase.com
- Área do curso: https://zeedo.ia.br/dashboard/curso
