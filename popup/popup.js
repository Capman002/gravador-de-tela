// Popup Script - Interface de controle da gravaÃ§Ã£o

import {
  MESSAGE_TYPES,
  RECORDING_STATE,
  formatTime,
  CAPTURE_SOURCES,
} from "../utils/constants.js";

// =============== DOM Elements ===============
const elements = {
  // Header
  settingsBtn: document.getElementById("settingsBtn"),

  // Status
  statusDisplay: document.getElementById("statusDisplay"),
  timer: document.getElementById("timer"),
  statusText: document.getElementById("statusText"),

  // Options
  optionsPanel: document.getElementById("optionsPanel"),
  sourceButtons: document.getElementById("sourceButtons"),
  qualitySelect: document.getElementById("qualitySelect"),
  formatSelect: document.getElementById("formatSelect"),
  fpsButtons: document.getElementById("fpsButtons"),
  captureAudio: document.getElementById("captureAudio"),
  captureMic: document.getElementById("captureMic"),
  formatNote: document.getElementById("formatNote"),

  // Recording Controls
  recordingControls: document.getElementById("recordingControls"),
  pauseBtn: document.getElementById("pauseBtn"),
  resumeBtn: document.getElementById("resumeBtn"),

  // Action
  actionBtn: document.getElementById("actionBtn"),
  actionBtnContent: document.getElementById("actionBtnContent"),
};

// =============== State ===============
let currentState = {
  recording: RECORDING_STATE.IDLE,
  elapsedSeconds: 0,
  selectedSource: CAPTURE_SOURCES.SCREEN,
  settings: {},
};

// =============== Initialization ===============
async function initialize() {
  await loadState();
  setupEventListeners();
  updateUI();

  // MantÃ©m conexÃ£o com background para keep-alive durante gravaÃ§Ã£o
  chrome.runtime.connect({ name: "keepalive" });
}

async function loadState() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_STATE,
    });

    if (response) {
      currentState.recording = response.recording || RECORDING_STATE.IDLE;
      currentState.elapsedSeconds = response.elapsedSeconds || 0;
      currentState.settings = response.settings || {};

      // Restaura configuraÃ§Ãµes na UI
      if (currentState.settings.quality) {
        elements.qualitySelect.value = currentState.settings.quality;
      }
      if (currentState.settings.format) {
        elements.formatSelect.value = currentState.settings.format;
      }
      if (currentState.settings.captureAudio !== undefined) {
        elements.captureAudio.checked = currentState.settings.captureAudio;
      }
      if (currentState.settings.captureMic !== undefined) {
        elements.captureMic.checked = currentState.settings.captureMic;
      }
      // Atualiza nota de formato
      updateFormatNote();

      // Restaura FPS selecionado
      updateFpsSelection(currentState.settings.fps || 60);
    }
  } catch (error) {
    console.error("Erro ao carregar estado:", error);
  }
}

// =============== Event Listeners ===============
function setupEventListeners() {
  // Settings button
  elements.settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Source selection
  elements.sourceButtons.querySelectorAll(".source-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectSource(btn.dataset.source);
    });
  });

  // FPS selection
  elements.fpsButtons.querySelectorAll(".fps-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectFps(parseInt(btn.dataset.fps));
    });
  });

  // Audio toggles and settings
  elements.captureAudio.addEventListener("change", updateSettings);
  elements.captureMic.addEventListener("change", updateSettings);
  elements.qualitySelect.addEventListener("change", updateSettings);
  elements.formatSelect.addEventListener("change", () => {
    updateFormatNote();
    updateSettings();
  });

  // Recording controls
  elements.pauseBtn.addEventListener("click", pauseRecording);
  elements.resumeBtn.addEventListener("click", resumeRecording);

  // Main action button
  elements.actionBtn.addEventListener("click", handleActionClick);

  // Listen for state updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MESSAGE_TYPES.STATE_UPDATE) {
      currentState.recording = message.state.recording;
      currentState.elapsedSeconds = message.state.elapsedSeconds;
      updateUI();
    }
  });
}

// =============== UI Updates ===============
function updateUI() {
  updateTimerDisplay();
  updateStatusText();
  updateActionButton();
  updatePanelVisibility();
  updateRecordingControls();
}

function updateTimerDisplay() {
  elements.timer.textContent = formatTime(currentState.elapsedSeconds);

  elements.timer.classList.remove("recording", "paused", "hidden");

  // Mostra timer apenas durante gravação ou pausa
  if (currentState.recording === RECORDING_STATE.RECORDING) {
    elements.timer.classList.add("recording");
  } else if (currentState.recording === RECORDING_STATE.PAUSED) {
    elements.timer.classList.add("paused");
  } else {
    elements.timer.classList.add("hidden");
  }
}

function updateStatusText() {
  let text = "Pronto para gravar";
  let className = "";

  switch (currentState.recording) {
    case RECORDING_STATE.RECORDING:
      text = "Gravando...";
      className = "recording";
      break;
    case RECORDING_STATE.PAUSED:
      text = "Pausado";
      className = "paused";
      break;
    case RECORDING_STATE.STOPPING:
      text = "Finalizando...";
      break;
    case RECORDING_STATE.COUNTDOWN:
      text = "Iniciando...";
      break;
  }

  elements.statusText.textContent = text;
  elements.statusText.className = `status-text ${className}`;
}

function updateActionButton() {
  const btn = elements.actionBtn;
  const content = elements.actionBtnContent;

  if (currentState.recording === RECORDING_STATE.IDLE) {
    btn.classList.remove("recording");
    content.innerHTML = `
      <svg class="record-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" fill="currentColor"/>
      </svg>
      <span>Iniciar GravaÃ§Ã£o</span>
    `;
  } else {
    btn.classList.add("recording");
    content.innerHTML = `
      <svg class="record-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
      </svg>
      <span>Parar GravaÃ§Ã£o</span>
    `;
  }
}

function updatePanelVisibility() {
  if (currentState.recording === RECORDING_STATE.IDLE) {
    elements.optionsPanel.classList.remove("hidden");
  } else {
    elements.optionsPanel.classList.add("hidden");
  }
}

function updateRecordingControls() {
  if (currentState.recording === RECORDING_STATE.RECORDING) {
    elements.recordingControls.classList.remove("hidden");
    elements.pauseBtn.classList.remove("hidden");
    elements.resumeBtn.classList.add("hidden");
  } else if (currentState.recording === RECORDING_STATE.PAUSED) {
    elements.recordingControls.classList.remove("hidden");
    elements.pauseBtn.classList.add("hidden");
    elements.resumeBtn.classList.remove("hidden");
  } else {
    elements.recordingControls.classList.add("hidden");
  }
}

// =============== Source & Settings Selection ===============
function selectSource(source) {
  currentState.selectedSource = source;

  elements.sourceButtons.querySelectorAll(".source-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.source === source);
  });
}

function selectFps(fps) {
  currentState.settings.fps = fps;
  updateFpsSelection(fps);
  updateSettings();
}

function updateFpsSelection(fps) {
  elements.fpsButtons.querySelectorAll(".fps-btn").forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.fps) === fps);
  });
}

function updateFormatNote() {
  const format = elements.formatSelect.value;
  if (format === "mp4") {
    elements.formatNote.querySelector(".format-note-text").textContent =
      "MP4 usa WebCodecs nativo para H.264 CFR";
  } else {
    elements.formatNote.querySelector(".format-note-text").textContent =
      "WebM usa MediaRecorder nativo (VP9 VFR)";
  }
}

async function updateSettings() {
  const settings = {
    quality: elements.qualitySelect.value,
    format: elements.formatSelect.value,
    fps: currentState.settings.fps || 60,
    captureAudio: elements.captureAudio.checked,
    captureMic: elements.captureMic.checked,
  };

  currentState.settings = { ...currentState.settings, ...settings };

  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    settings: settings,
  });
}

// =============== Recording Actions ===============
async function handleActionClick() {
  if (currentState.recording === RECORDING_STATE.IDLE) {
    await startRecording();
  } else {
    await stopRecording();
  }
}

async function startRecording() {
  try {
    // Atualiza settings antes de iniciar
    await updateSettings();

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.START_RECORDING,
      options: {
        ...currentState.settings,
        source: currentState.selectedSource,
      },
    });

    if (!response?.success) {
      showError(response?.error || "Erro ao iniciar gravaÃ§Ã£o");
    }
  } catch (error) {
    console.error("Erro ao iniciar gravaÃ§Ã£o:", error);
    showError(error.message);
  }
}

async function stopRecording() {
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.STOP_RECORDING,
    });
  } catch (error) {
    console.error("Erro ao parar gravaÃ§Ã£o:", error);
  }
}

async function pauseRecording() {
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.PAUSE_RECORDING,
    });
  } catch (error) {
    console.error("Erro ao pausar:", error);
  }
}

async function resumeRecording() {
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RESUME_RECORDING,
    });
  } catch (error) {
    console.error("Erro ao retomar:", error);
  }
}

// =============== Error Handling ===============
function showError(message) {
  // Temporariamente mostra no status
  elements.statusText.textContent = `Erro: ${message}`;
  elements.statusText.style.color = "#ef4444";

  setTimeout(() => {
    elements.statusText.style.color = "";
    updateStatusText();
  }, 3000);
}

// =============== Start ===============
document.addEventListener("DOMContentLoaded", initialize);
