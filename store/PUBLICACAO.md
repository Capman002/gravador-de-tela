# Guia de Publicação na Chrome Web Store

## Passo 1: Criar Conta de Desenvolvedor

1. Acesse: https://chrome.google.com/webstore/devconsole/
2. Faça login com sua conta Google
3. Pague a taxa única de $5 USD
4. Complete o cadastro

## Passo 2: Hospedar a Política de Privacidade

Opções gratuitas:

- **GitHub Pages**: Crie um repositório e ative Pages
- **GitHub Gist**: Cole o conteúdo e use a URL raw
- **Site pessoal**: Se você tiver um

### Exemplo com GitHub:

1. Crie um repositório público
2. Adicione o arquivo `PRIVACY.md` ou `privacy.html`
3. Ative GitHub Pages nas configurações
4. URL será: `https://seuusuario.github.io/repositorio/privacy.html`

## Passo 3: Criar Screenshots

Você precisa de pelo menos 1 screenshot. Recomendo 3-5.

### Tamanhos aceitos:

- 1280 x 800 pixels
- 640 x 400 pixels

### O que mostrar:

1. Popup da extensão aberto
2. Página de opções
3. Gravação em andamento (badge com tempo)
4. Diálogo de compartilhamento de tela

## Passo 4: Criar Imagem Promocional

### Tile pequeno (obrigatório):

- 440 x 280 pixels
- PNG

### Tile grande (opcional):

- 920 x 680 pixels
- PNG

## Passo 5: Compactar a Extensão

Execute este comando no PowerShell:

```powershell
# Na pasta do projeto
Compress-Archive -Path manifest.json, background.js, icons, offscreen, options, popup, utils -DestinationPath "gravador-de-tela.zip" -Force
```

**NÃO inclua:**

- node_modules
- .git
- store (pasta com materiais de marketing)
- Arquivos de desenvolvimento

## Passo 6: Upload e Submissão

1. No Developer Dashboard, clique em "New Item"
2. Faça upload do ZIP
3. Preencha:
   - Nome: Gravador de Tela Pro
   - Descrição curta e completa
   - Categoria: Produtividade
   - Idioma: Português (Brasil)
   - Screenshots
   - Imagem promocional
   - URL da Política de Privacidade
4. Clique em "Submit for Review"

## Passo 7: Aguardar Revisão

- Geralmente leva 1-3 dias úteis
- Você receberá email quando aprovado
- Se rejeitado, receberá feedback do motivo

## Dicas para Aprovação

✅ Descrição clara do que a extensão faz
✅ Política de privacidade acessível
✅ Screenshots de qualidade
✅ Apenas permissões necessárias
✅ Funcionalidade testada e funcionando

❌ Evitar palavras como "grátis", "melhor", "nº 1"
❌ Não usar marcas registradas
❌ Não coletar dados sem declarar
