# 🎬 Gravador de Tela Pro

Uma extensão Chrome de código aberto para gravação de tela em alta qualidade, com suporte a **MP4 H.264 CFR** nativo via WebCodecs.

![Chrome](https://img.shields.io/badge/Chrome-116+-green?logo=google-chrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Funcionalidades

- 🖥️ **Gravação de tela, janela ou aba** - Escolha exatamente o que quer capturar
- 🎯 **Até 4K 60fps** - Qualidade profissional
- 📹 **MP4 H.264 CFR** - Compatível com DaVinci Resolve, Premiere e outros editores
- 🎵 **Áudio do sistema + microfone** - Com controle de volume individual
- ⚡ **WebCodecs nativo** - Sem conversão posterior, gravação direta em MP4
- 🔒 **100% local** - Nenhum dado enviado para servidores externos
- ⌨️ **Atalhos de teclado** - `Alt+Shift+R` para abrir, `Alt+Shift+S` para gravar/parar

## 📦 Formatos Suportados

| Formato  | Codec              | CFR    | Uso                                     |
| -------- | ------------------ | ------ | --------------------------------------- |
| **MP4**  | H.264 High Profile | ✅ Sim | Edição profissional (DaVinci, Premiere) |
| **WebM** | VP9                | ❌ VFR | Web, compartilhamento rápido            |

## 🚀 Instalação

### Via Chrome Web Store

_Em breve_

### Manual (Desenvolvedor)

1. Clone o repositório:

```bash
git clone https://github.com/seu-usuario/gravador-de-tela.git
```

2. Abra `chrome://extensions` no Chrome

3. Ative o **Modo do desenvolvedor** (canto superior direito)

4. Clique em **Carregar sem compactação**

5. Selecione a pasta do projeto

## 🎮 Como Usar

1. Clique no ícone da extensão na barra de ferramentas
2. Selecione a **fonte de captura** (Tela, Janela ou Aba)
3. Escolha a **qualidade** (720p até 4K)
4. Selecione o **formato** (MP4 ou WebM)
5. Configure o **áudio** (sistema e/ou microfone)
6. Clique em **Iniciar Gravação**
7. Selecione a tela/janela/aba desejada
8. Clique novamente para **Parar**

O arquivo será salvo automaticamente na pasta de downloads.

## ⚙️ Configurações

Acesse as configurações clicando no ícone ⚙️ no popup:

- **Nome do arquivo** - Padrão customizável com `{date}` e `{time}`
- **Salvar automaticamente** - Sem diálogo de "Salvar como"
- **Contagem regressiva** - 3, 5 ou 10 segundos antes de iniciar

## 🛠️ Tecnologias

- **Manifest V3** - Arquitetura moderna de extensões Chrome
- **WebCodecs API** - Encoding H.264 nativo via GPU
- **mp4-muxer** - Muxing MP4 leve (~30KB)
- **MediaRecorder API** - Fallback para WebM
- **Offscreen Document** - Processamento em background

## 📁 Estrutura do Projeto

```
gravador-de-tela/
├── manifest.json          # Configuração da extensão
├── background.js          # Service Worker principal
├── popup/                 # Interface do usuário
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── offscreen/             # Processamento de mídia
│   ├── offscreen.html
│   ├── offscreen.js
│   └── mp4-muxer.min.js   # Muxer MP4 (31KB)
├── options/               # Página de configurações
│   ├── options.html
│   ├── options.css
│   └── options.js
├── utils/                 # Utilitários compartilhados
│   └── constants.js
└── icons/                 # Ícones da extensão
```

## 🔧 Requisitos

- **Google Chrome 116+** ou navegador baseado em Chromium
- Suporte a **WebCodecs API** (nativo no Chrome)

## 📝 Changelog

### v2.1.0 (Atual)

- ✨ Gravação MP4 H.264 CFR nativa via WebCodecs
- ✨ Sem necessidade de conversão posterior
- ✨ Interface simplificada
- 🗑️ Removido FFmpeg.wasm (era 24MB!)
- 🐛 Corrigido suporte a 4K 60fps

### v1.x

- Versões anteriores usavam MediaRecorder + conversão FFmpeg

## 📄 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 🐛 Reportando Bugs

Encontrou um bug? Abra uma [issue](https://github.com/seu-usuario/gravador-de-tela/issues) com:

- Descrição do problema
- Passos para reproduzir
- Versão do Chrome
- Console logs (se houver erros)

---

**Feito com ❤️ para a comunidade**
