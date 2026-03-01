# 📚 Instruções - Área de Membros do Curso

## ✅ O que foi criado:

### Frontend:
- ✅ Página principal `/dashboard/curso` - Lista todas as aulas estilo Netflix
- ✅ Página individual `/dashboard/curso/[id]` - Player de vídeo + navegação
- ✅ Sistema de progresso (barra de progresso, aulas concluídas)
- ✅ Link "Curso" no menu do dashboard
- ✅ Design responsivo e moderno

### Backend:
- ✅ API `/course/lessons` - Lista todas as aulas com progresso
- ✅ API `/course/lessons/{id}` - Busca uma aula específica
- ✅ API `/course/progress` - Marca aula como concluída
- ✅ API `/course/progress/stats` - Estatísticas de progresso

### Banco de Dados:
- ✅ Tabela `course_lessons` - Armazena as aulas
- ✅ Tabela `user_lesson_progress` - Progresso de cada aluno
- ✅ 7 aulas pré-cadastradas (sem vídeo ainda)

---

## 🎬 Como adicionar os vídeos:

### Passo 1: Criar conta no Vimeo (Grátis)
1. Acesse: https://vimeo.com/join
2. Crie uma conta gratuita
3. Confirme seu email

### Passo 2: Fazer upload dos vídeos
1. Acesse: https://vimeo.com/upload
2. Faça upload de 3-4 vídeos por semana (limite de 500 MB/semana)
3. Para cada vídeo:
   - Clique em **Settings** (Configurações)
   - Vá em **Privacy** (Privacidade)
   - Em **Where can this be embedded?**, escolha **Specific domains**
   - Adicione: `zeedo.ia.br`
   - Salve

### Passo 3: Copiar o link de embed
1. No Vimeo, abra o vídeo
2. Clique em **Share** (Compartilhar)
3. Copie o link que aparece em **Embed** (algo como: `https://player.vimeo.com/video/123456789`)

### Passo 4: Adicionar no banco de dados

Execute este SQL no Supabase para cada aula:

```sql
-- Aula 1
UPDATE course_lessons 
SET video_url = 'https://player.vimeo.com/video/SEU_VIDEO_ID_AQUI'
WHERE id = 1;

-- Aula 2
UPDATE course_lessons 
SET video_url = 'https://player.vimeo.com/video/SEU_VIDEO_ID_AQUI'
WHERE id = 2;

-- Aula 3
UPDATE course_lessons 
SET video_url = 'https://player.vimeo.com/video/SEU_VIDEO_ID_AQUI'
WHERE id = 3;

-- Aula 4
UPDATE course_lessons 
SET video_url = 'https://player.vimeo.com/video/SEU_VIDEO_ID_AQUI'
WHERE id = 4;

-- Aula 5
UPDATE course_lessons 
SET video_url = 'https://player.vimeo.com/video/SEU_VIDEO_ID_AQUI'
WHERE id = 5;

-- Aula 6
UPDATE course_lessons 
SET video_url = 'https://player.vimeo.com/video/SEU_VIDEO_ID_AQUI'
WHERE id = 6;

-- Aula 7
UPDATE course_lessons 
SET video_url = 'https://player.vimeo.com/video/SEU_VIDEO_ID_AQUI'
WHERE id = 7;
```

---

## 📝 Aulas pré-cadastradas:

1. **Bem-vindo ao Zeedo** (5:00)
   - Introdução à plataforma e primeiros passos

2. **Configurando sua Conta** (5:30)
   - Como conectar sua exchange e configurar o bot

3. **Entendendo os Sinais** (6:00)
   - Como funcionam os sinais de trading e Fibonacci

4. **Gerenciamento de Risco** (5:45)
   - Stop loss, alvos e gestão de capital

5. **Configurações Avançadas** (4:30)
   - Personalizando alvos, stop e entrada 2

6. **Análise de Resultados** (5:15)
   - Como interpretar suas estatísticas de trading

7. **Melhores Práticas** (4:45)
   - Dicas para maximizar seus resultados

---

## 🎨 Personalizações futuras (opcional):

### Adicionar thumbnails personalizados:
```sql
UPDATE course_lessons 
SET thumbnail = '/curso/thumb-aula-1.png'
WHERE id = 1;
```

### Editar título ou descrição:
```sql
UPDATE course_lessons 
SET title = 'Novo Título',
    description = 'Nova descrição'
WHERE id = 1;
```

### Adicionar nova aula:
```sql
INSERT INTO course_lessons (title, description, video_url, duration, thumbnail, lesson_order)
VALUES (
  'Nova Aula',
  'Descrição da nova aula',
  'https://player.vimeo.com/video/123456789',
  '5:00',
  '/zeedo-logo.png',
  8
);
```

---

## 🚀 Deploy:

### 1. Executar migration no Supabase:
```bash
# Copie o conteúdo de migrations/014_course_progress.sql
# Cole no SQL Editor do Supabase
# Execute
```

### 2. Reiniciar backend no VPS:
```bash
pm2 restart zeedo-backend
```

### 3. Rebuild frontend no VPS:
```bash
cd /home/zeedo/zeedo_vps/frontend
npm run build
pm2 restart zeedo-frontend
```

---

## 📊 Monitoramento:

### Ver progresso de todos os alunos:
```sql
SELECT 
  u.email,
  COUNT(CASE WHEN ulp.completed = true THEN 1 END) as aulas_concluidas,
  COUNT(cl.id) as total_aulas,
  ROUND(COUNT(CASE WHEN ulp.completed = true THEN 1 END)::numeric / COUNT(cl.id) * 100) as progresso_pct
FROM auth.users u
CROSS JOIN course_lessons cl
LEFT JOIN user_lesson_progress ulp ON ulp.user_id = u.id AND ulp.lesson_id = cl.id
GROUP BY u.id, u.email
ORDER BY progresso_pct DESC;
```

### Ver aulas mais assistidas:
```sql
SELECT 
  cl.title,
  COUNT(ulp.id) as total_views,
  COUNT(CASE WHEN ulp.completed = true THEN 1 END) as total_completed
FROM course_lessons cl
LEFT JOIN user_lesson_progress ulp ON ulp.lesson_id = cl.id
GROUP BY cl.id, cl.title
ORDER BY total_views DESC;
```

---

## 🎯 Recursos implementados:

- ✅ Layout estilo Netflix/Kiwify
- ✅ Player de vídeo embedado (Vimeo/YouTube)
- ✅ Sistema de progresso por aluno
- ✅ Marcar aulas como concluídas
- ✅ Navegação entre aulas (anterior/próxima)
- ✅ Barra de progresso geral do curso
- ✅ Badge de "Concluída" nas aulas
- ✅ Certificado ao completar 100%
- ✅ Lista de todas as aulas na página individual
- ✅ Design responsivo (mobile/desktop)
- ✅ Proteção de acesso (só usuários logados)

---

## 💡 Dicas:

1. **Organize seus vídeos**: Grave todos de uma vez para manter consistência
2. **Use boa iluminação**: Vídeos bem iluminados são mais profissionais
3. **Áudio limpo**: Use um microfone decente (até fone de ouvido serve)
4. **Seja objetivo**: 5 minutos é o ideal, não passe de 10 minutos
5. **Teste antes**: Assista seus vídeos antes de publicar
6. **Thumbnails**: Crie thumbnails personalizados para cada aula (opcional)

---

## 🆘 Problemas comuns:

### Vídeo não carrega:
- Verifique se o link está correto no banco
- Confirme que configurou a privacidade no Vimeo para `zeedo.ia.br`
- Teste o link diretamente no navegador

### Progresso não salva:
- Verifique se o backend está rodando
- Confira os logs: `pm2 logs zeedo-backend`
- Teste a API: `curl http://localhost:8000/course/lessons`

### Aula não aparece:
- Execute a migration 014_course_progress.sql
- Verifique se as aulas foram inseridas: `SELECT * FROM course_lessons;`

---

**Qualquer dúvida, me chame!** 🚀
