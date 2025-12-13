// Options Page Script - Gerencia configurações da extensão

import { DEFAULT_SETTINGS } from "../utils/constants.js";

// =============== DOM Elements ===============
const elements = {
  // Video
  defaultQuality: document.getElementById("defaultQuality"),
  defaultFps: document.getElementById("defaultFps"),
  defaultCodec: document.getElementById("defaultCodec"),
  codecHint: document.getElementById("codecHint"),

  // Audio
  captureAudio: document.getElementById("captureAudio"),
  captureMic: document.getElementById("captureMic"),
  tabVolume: document.getElementById("tabVolume"),
  tabVolumeValue: document.getElementById("tabVolumeValue"),
  micVolume: document.getElementById("micVolume"),
  micVolumeValue: document.getElementById("micVolumeValue"),
  tabVolumeContainer: document.getElementById("tabVolumeContainer"),
  micVolumeContainer: document.getElementById("micVolumeContainer"),

  // Recording
  showCountdown: document.getElementById("showCountdown"),
  countdownSeconds: document.getElementById("countdownSeconds"),
  countdownContainer: document.getElementById("countdownContainer"),
  autoSave: document.getElementById("autoSave"),
  filenamePattern: document.getElementById("filenamePattern"),

  // Shortcuts
  openShortcuts: document.getElementById("openShortcuts"),

  // Actions
  resetBtn: document.getElementById("resetBtn"),
  saveBtn: document.getElementById("saveBtn"),
};

// =============== Initialization ===============
async function initialize() {
  await loadSettings();
  setupEventListeners();
  updateVisibility();
}

async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...stored.settings };

  // Video
  elements.defaultQuality.value = settings.quality;
  elements.defaultFps.value = settings.fps.toString();

  // Compatibilidade: usar format ou codec
  if (elements.defaultCodec) {
    elements.defaultCodec.value = settings.format || settings.codec || "mp4";
    updateCodecHint(settings.format || settings.codec || "mp4");
  }

  // Audio
  elements.captureAudio.checked = settings.captureAudio;
  elements.captureMic.checked = settings.captureMic;
  elements.tabVolume.value = settings.tabVolume;
  elements.tabVolumeValue.textContent = `${settings.tabVolume}%`;
  elements.micVolume.value = settings.micVolume;
  elements.micVolumeValue.textContent = `${settings.micVolume}%`;

  // Recording
  elements.showCountdown.checked = settings.showCountdown;
  elements.countdownSeconds.value = settings.countdownSeconds.toString();
  elements.autoSave.checked = settings.autoSave;
  elements.filenamePattern.value = settings.filenamePattern;
}

// Atualiza dica do codec
function updateCodecHint(codec) {
  const hints = {
    mp4: "Compativel com DaVinci Resolve, Premiere, After Effects",
    webm: "Alta qualidade, bom para YouTube e web",
    h264_mp4: "Compativel com DaVinci Resolve, Premiere, After Effects",
    vp9: "Alta qualidade, bom para YouTube e web",
    vp8: "Boa compatibilidade com navegadores antigos",
  };
  if (elements.codecHint) {
    elements.codecHint.textContent = hints[codec] || hints.mp4;
  }
}

// =============== Event Listeners ===============
function setupEventListeners() {
  // Audio toggles affect volume visibility
  elements.captureAudio.addEventListener("change", updateVisibility);
  elements.captureMic.addEventListener("change", updateVisibility);

  // Countdown toggle affects seconds visibility
  elements.showCountdown.addEventListener("change", updateVisibility);

  // Codec hint update
  if (elements.defaultCodec) {
    elements.defaultCodec.addEventListener("change", () => {
      updateCodecHint(elements.defaultCodec.value);
    });
  }

  // Volume sliders update display
  elements.tabVolume.addEventListener("input", () => {
    elements.tabVolumeValue.textContent = `${elements.tabVolume.value}%`;
  });

  elements.micVolume.addEventListener("input", () => {
    elements.micVolumeValue.textContent = `${elements.micVolume.value}%`;
  });

  // Open shortcuts page
  elements.openShortcuts.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

  // Reset to defaults
  elements.resetBtn.addEventListener("click", resetToDefaults);

  // Save settings
  elements.saveBtn.addEventListener("click", saveSettings);
}

// =============== Visibility Updates ===============
function updateVisibility() {
  // Volume containers
  elements.tabVolumeContainer.style.display = elements.captureAudio.checked
    ? "flex"
    : "none";
  elements.micVolumeContainer.style.display = elements.captureMic.checked
    ? "flex"
    : "none";

  // Countdown seconds
  elements.countdownContainer.style.display = elements.showCountdown.checked
    ? "flex"
    : "none";
}

// =============== Settings Management ===============
function getSettingsFromUI() {
  return {
    quality: elements.defaultQuality.value,
    fps: parseInt(elements.defaultFps.value),
    format: elements.defaultCodec ? elements.defaultCodec.value : "mp4",
    captureAudio: elements.captureAudio.checked,
    captureMic: elements.captureMic.checked,
    tabVolume: parseInt(elements.tabVolume.value),
    micVolume: parseInt(elements.micVolume.value),
    showCountdown: elements.showCountdown.checked,
    countdownSeconds: parseInt(elements.countdownSeconds.value),
    autoSave: elements.autoSave.checked,
    filenamePattern: elements.filenamePattern.value,
  };
}

async function saveSettings() {
  const settings = getSettingsFromUI();

  // Valida padrao de nome de arquivo
  const filenameValidation = validateFilenamePattern(settings.filenamePattern);
  if (!filenameValidation.valid) {
    showNotification(filenameValidation.error, "error");
    return;
  }

  try {
    await chrome.storage.local.set({ settings });
    showNotification("Configuracoes salvas com sucesso!", "success");
  } catch (error) {
    showNotification("Erro ao salvar configuracoes", "error");
  }
}

function validateFilenamePattern(pattern) {
  if (!pattern || pattern.trim() === "") {
    return { valid: false, error: "O padrao de nome nao pode estar vazio" };
  }

  // Caracteres invalidos para nomes de arquivo no Windows
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(pattern)) {
    return {
      valid: false,
      error: 'O padrao contem caracteres invalidos: < > : " / \\ | ? *',
    };
  }

  return { valid: true };
}

async function resetToDefaults() {
  if (!confirm("Tem certeza que deseja restaurar as configuracoes padrao?")) {
    return;
  }

  try {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    await loadSettings();
    updateVisibility();
    showNotification("Configuracoes restauradas!", "success");
  } catch (error) {
    showNotification("Erro ao restaurar configuracoes", "error");
  }
}

// =============== Notifications ===============
function showNotification(message, type = "info") {
  // Remove notificacao existente
  const existing = document.querySelector(".notification");
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Anima entrada
  setTimeout(() => notification.classList.add("show"), 10);

  // Remove apos 3 segundos
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// =============== Start ===============
initialize();
