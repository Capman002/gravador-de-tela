// Options Page Script - Gerencia configuraÃ§Ãµes da extensÃ£o

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
  elements.defaultCodec.value = settings.codec;
  updateCodecHint(settings.codec);

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
    h264_mp4: "âœ… CompatÃ­vel com DaVinci Resolve, Premiere, After Effects",
    vp9: "Alta qualidade, bom para YouTube e web",
    vp8: "Boa compatibilidade com navegadores antigos",
    h264_webm: "Usa aceleraÃ§Ã£o de hardware, WebM container",
  };
  if (elements.codecHint) {
    elements.codecHint.textContent = hints[codec] || hints.h264_mp4;
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
  elements.defaultCodec.addEventListener("change", () => {
    updateCodecHint(elements.defaultCodec.value);
  });

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
    codec: elements.defaultCodec.value,
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

    "[Options] Salvando configuraÃ§Ãµes:",
    JSON.stringify(settings, null, 2)
  );

  // Valida padrÃ£o de nome de arquivo
  const filenameValidation = validateFilenamePattern(settings.filenamePattern);
  if (!filenameValidation.valid) {
    showNotification(filenameValidation.error, "error");
    return;
  }

  try {
    await chrome.storage.local.set({ settings });
    showNotification("ConfiguraÃ§Ãµes salvas com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao salvar configuraÃ§Ãµes:", error);
    showNotification("Erro ao salvar configuraÃ§Ãµes", "error");
  }
}

function validateFilenamePattern(pattern) {
  if (!pattern || pattern.trim() === "") {
    return { valid: false, error: "O padrÃ£o de nome nÃ£o pode estar vazio" };
  }

  // Caracteres invÃ¡lidos para nomes de arquivo no Windows
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(pattern)) {
    return {
      valid: false,
      error: 'O padrÃ£o contÃ©m caracteres invÃ¡lidos: < > : " / \\ | ? *',
    };
  }

  return { valid: true };
}

async function resetToDefaults() {
  if (!confirm("Tem certeza que deseja restaurar as configuraÃ§Ãµes padrÃ£o?")) {
    return;
  }

  try {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    await loadSettings();
    updateVisibility();
    showNotification("ConfiguraÃ§Ãµes restauradas!", "success");
  } catch (error) {
    console.error("Erro ao restaurar configuraÃ§Ãµes:", error);
    showNotification("Erro ao restaurar configuraÃ§Ãµes", "error");
  }
}

// =============== Notifications ===============
function showNotification(message, type = "info") {
  // Remove notificaÃ§Ã£o existente
  const existing = document.querySelector(".notification");
  if (existing) {
    existing.remove();
  }

  // Cria nova notificaÃ§Ã£o
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button class="notification-close">&times;</button>
  `;

  // Estilo inline para a notificaÃ§Ã£o
  notification.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 16px 20px;
    background: ${
      type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : "#3b82f6"
    };
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;

  // Adiciona ao DOM
  document.body.appendChild(notification);

  // Event listener para fechar
  notification
    .querySelector(".notification-close")
    .addEventListener("click", () => {
      notification.remove();
    });

  // Auto-remove apÃ³s 3 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);

  // Adiciona keyframes se nÃ£o existirem
  if (!document.querySelector("#notification-styles")) {
    const style = document.createElement("style");
    style.id = "notification-styles";
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      .notification-close:hover {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }
}

// =============== Start ===============
document.addEventListener("DOMContentLoaded", initialize);
