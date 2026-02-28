# Instruções para Corrigir Ícone do iOS

## Problema
O ícone do Zeedo aparece esticado na home screen do iPhone porque a imagem não está no formato correto.

## Solução

### Opção 1: Usar um Editor de Imagem (Recomendado)

1. Abra `frontend/public/zeedo-logo.png` em um editor de imagem (Photoshop, GIMP, Figma, etc.)

2. **Redimensione para 180x180px** mantendo a proporção:
   - Se a imagem for retangular, adicione padding/margem para torná-la quadrada
   - Certifique-se de que o conteúdo principal (robô Zeedo) está centralizado
   - Deixe uma pequena margem ao redor (iOS aplica bordas arredondadas automaticamente)

3. Exporte como **PNG** com as seguintes dimensões:
   - `apple-touch-icon.png` → 180x180px (obrigatório)
   - Opcional: `apple-touch-icon-152x152.png` → 152x152px (iPad)
   - Opcional: `apple-touch-icon-167x167.png` → 167x167px (iPad Pro)

4. Salve na pasta `frontend/public/`

### Opção 2: Usar ImageMagick (Linha de Comando)

Se você tiver ImageMagick instalado:

```bash
# Redimensiona mantendo proporção e adiciona padding para tornar quadrado
magick frontend/public/zeedo-logo.png -resize 180x180 -background black -gravity center -extent 180x180 frontend/public/apple-touch-icon.png
```

### Opção 3: Usar Ferramenta Online

1. Acesse: https://www.websiteplanet.com/webtools/favicon-generator/
2. Faça upload do `zeedo-logo.png`
3. Baixe o pacote de ícones
4. Substitua `apple-touch-icon.png` na pasta `frontend/public/`

## Especificações do iOS

- **Dimensões**: 180x180px (mínimo recomendado)
- **Formato**: PNG
- **Fundo**: Opaco (sem transparência)
- **Proporção**: 1:1 (quadrado perfeito)
- **Margens**: Deixe ~10px de margem interna (iOS aplica bordas arredondadas)

## Verificação

Após substituir o arquivo:

1. Limpe o cache do navegador
2. No iPhone, remova o ícone antigo da home screen
3. Adicione novamente à home screen
4. Verifique se o ícone aparece sem distorção

## Arquivos Atualizados

✅ `frontend/app/layout.tsx` - Metadata atualizado
✅ `frontend/app/bot/layout.tsx` - Metadata atualizado
✅ `frontend/app/acesso-antecipado/layout.tsx` - Metadata atualizado

Todos os layouts agora apontam para `/apple-touch-icon.png` com as configurações corretas para iOS.
