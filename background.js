// Service Worker Principal - Gerencia estado global da extensão

import {
  DEFAULT_SETTINGS,
  RECORDING_STATE,
  MESSAGE_TYPES,
  OUTPUT_FORMATS,
  formatTime,
  generateFilename,
} from "./utils/constants.js";

// Estado global
let state = {
  recording: RECORDING_STATE.IDLE,
  startTime: null,
  elapsedSeconds: 0,
  settings: { ...DEFAULT_SETTINGS },
};

let timerInterval = null;
let offscreenDocumentCreated = false;

// ============ OFFSCREEN DOCUMENT MANAGEMENT ============

async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) return true;

  // Verifica se já existe
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL("offscreen/offscreen.html")],
  });

  if (existingContexts.length > 0) {
    offscreenDocumentCreated = true;
    return true;
  }

  // Cria o documento offscreen
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["USER_MEDIA", "DISPLAY_MEDIA"],
      justification: "Gravar tela/aba com MediaRecorder",
    });
    offscreenDocumentCreated = true;
    return true;
  } catch (error) {
    console.error("Erro ao criar documento offscreen:", error);
    return false;
  }
}

async function closeOffscreenDocument() {
  if (!offscreenDocumentCreated) return;

  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
  } catch (error) {
    console.error("Erro ao fechar documento offscreen:", error);
  }
}

// ============ BADGE & ICON MANAGEMENT ============

async function updateBadge() {
  if (state.recording === RECORDING_STATE.RECORDING) {
    const timeText = formatTime(state.elapsedSeconds);
    // Mostra apenas minutos:segundos na badge (espaço limitado)
    const badgeText =
      state.elapsedSeconds < 3600
        ? timeText
        : `${Math.floor(state.elapsedSeconds / 3600)}h`;

    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  } else if (state.recording === RECORDING_STATE.PAUSED) {
    await chrome.action.setBadgeText({ text: "⏸" });
    await chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
}

async function updateIcon(isRecording) {
  const iconPath = isRecording ? "icons/recording" : "icons/icon";
  await chrome.action.setIcon({
    path: {
      16: `${iconPath}16.png`,
      48: `${iconPath}48.png`,
      128: `${iconPath}128.png`,
    },
  });
}

// ============ TIMER MANAGEMENT ============

function startTimer() {
  state.startTime = Date.now();
  state.elapsedSeconds = 0;

  timerInterval = setInterval(async () => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    await updateBadge();

    // Notifica popup se estiver aberto
    broadcastState();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function pauseTimer() {
  stopTimer();
  // Mantém o tempo pausado
}

function resumeTimer() {
  // Ajusta o startTime para manter o tempo correto
  state.startTime = Date.now() - state.elapsedSeconds * 1000;

  timerInterval = setInterval(async () => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    await updateBadge();
    broadcastState();
  }, 1000);
}

// ============ STATE BROADCASTING ============

function broadcastState() {
  chrome.runtime
    .sendMessage({
      type: MESSAGE_TYPES.STATE_UPDATE,
      state: {
        recording: state.recording,
        elapsedSeconds: state.elapsedSeconds,
        settings: state.settings,
      },
    })
    .catch(() => {
      // Popup pode não estar aberto, ignora erro
    });
}

// ============ RECORDING CONTROL ============

async function startRecording(options = {}) {
  if (state.recording !== RECORDING_STATE.IDLE) {
    return { success: false, error: "Já existe uma gravação em andamento" };
  }

  try {
    // Carrega configurações mais recentes
    const stored = await chrome.storage.local.get("settings");
    if (stored.settings) {
      state.settings = { ...DEFAULT_SETTINGS, ...stored.settings };
    }

    // Merge com opções específicas desta gravação
    const recordingOptions = { ...state.settings, ...options };

    // Garante que o documento offscreen existe
    const offscreenReady = await ensureOffscreenDocument();
    if (!offscreenReady) {
      return { success: false, error: "Falha ao criar contexto de gravação" };
    }

    // Envia comando para o offscreen
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OFFSCREEN_START,
      options: recordingOptions,
    });

    if (response?.success) {
      state.recording = RECORDING_STATE.RECORDING;
      await updateIcon(true);
      startTimer();
      broadcastState();
      return { success: true };
    } else {
      return { success: false, error: response?.error || "Erro desconhecido" };
    }
  } catch (error) {
    console.error("Erro ao iniciar gravação:", error);
    return { success: false, error: error.message };
  }
}

async function stopRecording() {
  if (state.recording === RECORDING_STATE.IDLE) {
    return { success: false, error: "Nenhuma gravação em andamento" };
  }

  try {
    state.recording = RECORDING_STATE.STOPPING;
    broadcastState();

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OFFSCREEN_STOP,
    });

    stopTimer();
    state.recording = RECORDING_STATE.IDLE;
    state.elapsedSeconds = 0;

    await updateIcon(false);
    await updateBadge();
    broadcastState();

    // Fecha o documento offscreen após um delay
    setTimeout(() => closeOffscreenDocument(), 1000);

    return { success: true, filename: response?.filename };
  } catch (error) {
    console.error("Erro ao parar gravação:", error);
    state.recording = RECORDING_STATE.IDLE;
    await updateIcon(false);
    await updateBadge();
    return { success: false, error: error.message };
  }
}

async function pauseRecording() {
  if (state.recording !== RECORDING_STATE.RECORDING) {
    return { success: false, error: "Gravação não está ativa" };
  }

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OFFSCREEN_PAUSE,
    });

    state.recording = RECORDING_STATE.PAUSED;
    pauseTimer();
    await updateBadge();
    broadcastState();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function resumeRecording() {
  if (state.recording !== RECORDING_STATE.PAUSED) {
    return { success: false, error: "Gravação não está pausada" };
  }

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OFFSCREEN_RESUME,
    });

    state.recording = RECORDING_STATE.RECORDING;
    resumeTimer();
    await updateBadge();
    broadcastState();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function toggleRecording() {
  if (state.recording === RECORDING_STATE.IDLE) {
    return await startRecording();
  } else if (
    state.recording === RECORDING_STATE.RECORDING ||
    state.recording === RECORDING_STATE.PAUSED
  ) {
    return await stopRecording();
  }
}

// ============ MESSAGE HANDLERS ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Mensagens assíncronas
  (async () => {
    let response;

    switch (message.type) {
      case MESSAGE_TYPES.START_RECORDING:
        response = await startRecording(message.options);
        break;

      case MESSAGE_TYPES.STOP_RECORDING:
        response = await stopRecording();
        break;

      case MESSAGE_TYPES.PAUSE_RECORDING:
        response = await pauseRecording();
        break;

      case MESSAGE_TYPES.RESUME_RECORDING:
        response = await resumeRecording();
        break;

      case MESSAGE_TYPES.GET_STATE:
        response = {
          recording: state.recording,
          elapsedSeconds: state.elapsedSeconds,
          settings: state.settings,
        };
        break;

      case MESSAGE_TYPES.UPDATE_SETTINGS:
        state.settings = { ...state.settings, ...message.settings };
        await chrome.storage.local.set({ settings: state.settings });
        response = { success: true };
        break;

      case MESSAGE_TYPES.RECORDING_STOPPED:
        // Notificação do offscreen que a gravação terminou
        if (message.converting) {
          // Está convertendo, aguarda conclusão
          console.log("Convertendo vídeo para MP4...");
        } else if (message.blob) {
          // Gravação/conversão concluída, salva arquivo
          await saveRecording(message.blob, message.extension);
        }
        break;

      case MESSAGE_TYPES.RECORDING_ERROR:
        console.error("Erro de gravação:", message.error);
        state.recording = RECORDING_STATE.IDLE;
        stopTimer();
        await updateIcon(false);
        await updateBadge();
        broadcastState();
        break;

      default:
        response = { error: "Tipo de mensagem desconhecido" };
    }

    sendResponse(response);
  })();

  return true; // Indica resposta assíncrona
});

// ============ COMMAND HANDLERS ============

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-recording") {
    await toggleRecording();
  }
});

// ============ FILE SAVING ============

async function saveRecording(blobUrl, extension) {
  // Usa a extensão recebida ou obtém do formato configurado
  const ext =
    extension ||
    OUTPUT_FORMATS[state.settings.outputFormat]?.extension ||
    ".webm";
  const filename = generateFilename(state.settings.filenamePattern, ext);

  try {
    await chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: !state.settings.autoSave,
    });
  } catch (error) {
    console.error("Erro ao salvar arquivo:", error);
  }
}

// ============ INITIALIZATION ============

async function initialize() {
  // Carrega configurações salvas
  const stored = await chrome.storage.local.get("settings");
  if (stored.settings) {
    state.settings = { ...DEFAULT_SETTINGS, ...stored.settings };
  }

  // Garante estado inicial limpo
  await updateIcon(false);
  await updateBadge();

  console.log("Gravador de Tela Pro inicializado");
}

// Inicializa quando o service worker começa
initialize();

// Mantém o service worker vivo durante gravação
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "keepalive") {
    // Mantém conexão aberta
  }
});
