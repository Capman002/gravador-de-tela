// Service Worker Principal - Gerencia estado global da extensão

import {
  DEFAULT_SETTINGS,
  RECORDING_STATE,
  MESSAGE_TYPES,
  RECORDING_FORMATS,
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

// Migra configurações antigas para nova versão
async function migrateSettings() {
  const stored = await chrome.storage.local.get("settings");
  if (stored.settings) {
    const settings = stored.settings;
    let needsMigration = false;

    // Migra codec antigo para novo formato
    if (settings.codec && !settings.format) {
      if (settings.codec === "h264_mp4" || settings.codec === "h264") {
        settings.format = "mp4";
      } else {
        settings.format = "webm";
      }
      delete settings.codec;
      needsMigration = true;
    }

    // Remove enableCFR (agora é automático)
    if (settings.enableCFR !== undefined) {
      delete settings.enableCFR;
      needsMigration = true;
    }

    if (needsMigration) {
      await chrome.storage.local.set({ settings });
    }
  }
}

// Executa migração na inicialização
migrateSettings();

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
      justification: "Gravar tela/aba com WebCodecs",
    });
    offscreenDocumentCreated = true;
    return true;
  } catch (error) {
    return false;
  }
}

async function closeOffscreenDocument() {
  if (!offscreenDocumentCreated) return;

  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
  } catch (error) {
    // Handle silently
  }
}

// ============ BADGE & ICON MANAGEMENT ============

async function updateBadge() {
  if (state.recording === RECORDING_STATE.RECORDING) {
    const timeText = formatTime(state.elapsedSeconds);
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

  timerInterval = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    updateBadge();
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
}

function resumeTimer() {
  // Ajusta o startTime para manter o tempo já decorrido
  state.startTime = Date.now() - state.elapsedSeconds * 1000;

  timerInterval = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    updateBadge();
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
      },
    })
    .catch(() => {
      // Popup pode estar fechado, ignora erro
    });
}

// ============ RECORDING CONTROL ============

async function startRecording(source) {
  if (state.recording !== RECORDING_STATE.IDLE) {
    return { success: false, error: "Já está gravando" };
  }

  // Cria documento offscreen se necessário
  const offscreenReady = await ensureOffscreenDocument();
  if (!offscreenReady) {
    return { success: false, error: "Erro ao criar documento offscreen" };
  }

  // Carrega configurações mais recentes
  const stored = await chrome.storage.local.get("settings");
  if (stored.settings) {
    state.settings = { ...DEFAULT_SETTINGS, ...stored.settings };
  }

  // Prepara opções de gravação
  const recordingOptions = {
    ...state.settings,
    source: source || "screen",
  };

  // Envia comando para offscreen
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OFFSCREEN_START,
      options: recordingOptions,
    });

    state.recording = RECORDING_STATE.RECORDING;
    startTimer();
    await updateIcon(true);
    await updateBadge();
    broadcastState();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function stopRecording() {
  if (
    state.recording !== RECORDING_STATE.RECORDING &&
    state.recording !== RECORDING_STATE.PAUSED
  ) {
    return { success: false, error: "Não está gravando" };
  }

  state.recording = RECORDING_STATE.STOPPING;
  broadcastState();

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OFFSCREEN_STOP,
    });

    stopTimer();
    state.recording = RECORDING_STATE.IDLE;
    state.elapsedSeconds = 0;
    await updateIcon(false);
    await updateBadge();
    broadcastState();

    return { success: true };
  } catch (error) {
    state.recording = RECORDING_STATE.IDLE;
    stopTimer();
    await updateIcon(false);
    await updateBadge();
    broadcastState();
    return { success: false, error: error.message };
  }
}

async function pauseRecording() {
  if (state.recording !== RECORDING_STATE.RECORDING) {
    return { success: false, error: "Não está gravando" };
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
    return { success: false, error: "Não está pausado" };
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
  } else {
    return await stopRecording();
  }
}

// ============ MESSAGE HANDLING ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    let response;

    switch (message.type) {
      case MESSAGE_TYPES.START_RECORDING:
        response = await startRecording(message.source);
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

      case MESSAGE_TYPES.RECORDING_STARTED:
        // Já tratado no startRecording
        break;

      case MESSAGE_TYPES.RECORDING_STOPPED:
        // Notificação do offscreen que a gravação terminou
        if (message.blob) {
          // Salva diretamente (WebCodecs já gera MP4 H.264 CFR)
          await saveRecording(message.blob, message.extension);
        }
        break;

      case MESSAGE_TYPES.RECORDING_ERROR:
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
  let ext = extension;

  if (!ext) {
    const formatInfo = RECORDING_FORMATS[state.settings.format];
    ext = formatInfo?.extension || ".mp4";
  }

  const filename = generateFilename(state.settings.filenamePattern, ext);

  try {
    await chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: !state.settings.autoSave,
    });
  } catch (error) {
    // Handle silently
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
}

// Inicializa quando o service worker começa
initialize();

// Mantém o service worker vivo durante gravação
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "keepalive") {
    // Mantém conexão aberta
  }
});
