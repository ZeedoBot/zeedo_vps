# 📸 Capas das Aulas do Curso

## Como adicionar as capas:

1. **Coloque as imagens nesta pasta** (`frontend/public/curso/`)
2. **Nomeie os arquivos** exatamente assim:
   - `aula-1.jpg` ou `aula-1.png`
   - `aula-2.jpg` ou `aula-2.png`
   - `aula-3.jpg` ou `aula-3.png`
   - `aula-4.jpg` ou `aula-4.png`
   - `aula-5.jpg` ou `aula-5.png`
   - `aula-6.jpg` ou `aula-6.png`
   - `aula-7.jpg` ou `aula-7.png`

3. **Execute no Supabase** (SQL Editor):

```sql
UPDATE course_lessons SET thumbnail = '/curso/aula-1.jpg' WHERE lesson_order = 1;
UPDATE course_lessons SET thumbnail = '/curso/aula-2.jpg' WHERE lesson_order = 2;
UPDATE course_lessons SET thumbnail = '/curso/aula-3.jpg' WHERE lesson_order = 3;
UPDATE course_lessons SET thumbnail = '/curso/aula-4.jpg' WHERE lesson_order = 4;
UPDATE course_lessons SET thumbnail = '/curso/aula-5.jpg' WHERE lesson_order = 5;
UPDATE course_lessons SET thumbnail = '/curso/aula-6.jpg' WHERE lesson_order = 6;
UPDATE course_lessons SET thumbnail = '/curso/aula-7.jpg' WHERE lesson_order = 7;
```

## 🎨 Especificações das imagens:

- **Formato**: JPG ou PNG
- **Tamanho recomendado**: 1280x720px (16:9) - **OBRIGATÓRIO formato horizontal**
- **Tamanho mínimo**: 640x360px
- **Peso máximo**: 500KB por imagem
- **Estilo**: Use a paleta Zeedo (laranja #FF6B35, preto, branco)

⚠️ **IMPORTANTE:** As capas DEVEM ter proporção 16:9 (formato horizontal/paisagem) para aparecerem corretamente no layout estilo Netflix com scroll horizontal.

## 📝 Aulas:

1. **Introdução ao Zeedo**
2. **Como criar e conectar a Carteira**
3. **Como conectar o Telegram**
4. **Como configurar o Bot**
5. **Configurações Avançadas**
6. **Dicas de gerenciamento de risco**
7. **Desvendando o operacional do Zeedo**

## 💡 Dicas para as capas:

- Use imagens relacionadas ao tema de cada aula
- Mantenha consistência visual entre todas as capas
- Adicione o número da aula na imagem (Aula 1, Aula 2, etc.)
- Use filtros escuros para manter o estilo tech
- Destaque elementos em laranja (cor Zeedo)

## 🚀 Após adicionar as imagens:

1. Faça commit e push:
```bash
git add frontend/public/curso/
git commit -m "Adicionar capas das aulas do curso"
git push
```

2. No VPS, faça pull e rebuild:
```bash
cd ~/zeedo_vps
git pull
cd frontend
npm run build
pm2 restart zeedo-frontend
```

3. Execute o SQL no Supabase para atualizar os thumbnails
