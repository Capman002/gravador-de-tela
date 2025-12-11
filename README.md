# 🎬 Gravador de Tela Pro

Extensão Chrome Manifest V3 para gravação de tela, aba ou janela em alta qualidade (até 4K).

## ✨ Recursos

- **Qualidade até 4K**: Suporte para 720p, 1080p, 1440p e 4K Ultra HD
- **FPS Configurável**: 30 ou 60 FPS para gravações suaves
- **Captura de Áudio**: Grava áudio da aba/tela + microfone com volumes separados
- **100% Local**: Nenhum dado é enviado para servidores - tudo roda no seu navegador
- **Atalhos Globais**: Inicie/pare gravações sem abrir o popup
- **UI Moderna**: Interface minimalista com tema escuro
- **Badge de Tempo**: Veja o tempo de gravação diretamente no ícone

## 🚀 Instalação

### Via Modo Desenvolvedor (Recomendado para teste)

1. Clone ou baixe este repositório
2. Abra o Chrome e acesse `chrome://extensions/`
3. Ative o **Modo Desenvolvedor** (toggle no canto superior direito)
4. Clique em **Carregar sem compactação**
5. Selecione a pasta `gravador-de-tela`

### Atalhos de Teclado

| Atalho            | Ação                   |
| ----------------- | ---------------------- |
| `Alt + Shift + R` | Abrir popup            |
| `Alt + Shift + S` | Iniciar/Parar gravação |

Para personalizar os atalhos, acesse `chrome://extensions/shortcuts`

## 📁 Estrutura do Projeto

```
gravador-de-tela/
├── manifest.json          # Configuração da extensão
├── background.js          # Service Worker principal
├── icons/                 # Ícones da extensão
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── recording16.png
│   ├── recording48.png
│   └── recording128.png
├── offscreen/             # Documento offscreen para gravação
│   ├── offscreen.html
│   └── offscreen.js
├── popup/                 # Interface do popup
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/               # Página de configurações
│   ├── options.html
│   ├── options.css
│   └── options.js
└── utils/                 # Utilitários compartilhados
    └── constants.js
```

## ⚙️ Configurações

Acesse as configurações clicando no ícone de engrenagem no popup ou navegando até:
`chrome://extensions` → Gravador de Tela Pro → Detalhes → Opções da extensão

### Opções Disponíveis

- **Qualidade de Vídeo**: 720p até 4K
- **Taxa de Quadros**: 30 ou 60 FPS
- **Codec**: VP9, VP8 ou H.264
- **Captura de Áudio**: Sistema e/ou Microfone
- **Volumes Separados**: Controle independente para sistema e microfone
- **Contagem Regressiva**: 3, 5 ou 10 segundos antes de iniciar
- **Padrão de Nome**: Personalize o nome dos arquivos salvos

## 🔒 Privacidade

Esta extensão foi desenvolvida com privacidade em mente:

- ✅ **Sem coleta de dados**: Nenhuma informação é coletada ou transmitida
- ✅ **Processamento local**: Toda gravação ocorre localmente no navegador
- ✅ **Sem analytics**: Nenhum código de rastreamento incluído
- ✅ **Armazenamento local**: Configurações salvas apenas no seu navegador
- ✅ **Código aberto**: Todo o código é transparente e auditável

## 📝 Tecnologias

- **Manifest V3**: Última versão do formato de extensões Chrome
- **getDisplayMedia API**: Captura de tela nativa do navegador
- **MediaRecorder API**: Gravação de streams de mídia
- **AudioContext**: Mixagem de múltiplas fontes de áudio
- **Offscreen Documents**: Gravação em background sem UI

## 🐛 Solução de Problemas

### A gravação não inicia

- Verifique se você concedeu permissão para compartilhar a tela
- Certifique-se de que nenhuma outra extensão está usando a câmera/microfone

### Áudio não está sendo gravado

- Para áudio da aba, certifique-se de marcar "Compartilhar áudio da aba" no diálogo de compartilhamento
- Para microfone, conceda a permissão quando solicitado

### O arquivo está corrompido

- Não feche o navegador abruptamente durante a gravação
- Certifique-se de clicar em "Parar" antes de fechar

## 📄 Licença

MIT License - Livre para uso pessoal e comercial.

---

Desenvolvido com ❤️
