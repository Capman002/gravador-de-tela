// Options Page Script - Gerencia configurações da extensão

import { DEFAULT_SETTINGS } from "../utils/constants.js";

// =============== DOM Elements ===============
const elements = {
  // Video
  defaultQuality: document.getElementById("defaultQuality"),
  defaultFps: document.getElementById("defaultFps"),
  defaultCodec: document.getElementById("defaultCodec"),
  outputFormat: document.getElementById("outputFormat"),
  formatHint: document.getElementById("formatHint"),

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
  elements.outputFormat.value = settings.outputFormat || "webm";
  updateFormatHint(settings.outputFormat || "webm");

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

// Atualiza dica do formato de saída
function updateFormatHint(format) {
  const hints = {
    webm: "Formato nativo, gravação imediata",
    mp4: "⚠️ Conversão após gravação (~31MB de download inicial)",
  };
  elements.formatHint.textContent = hints[format] || hints.webm;
}

// =============== Event Listeners ===============
function setupEventListeners() {
  // Audio toggles affect volume visibility
  elements.captureAudio.addEventListener("change", updateVisibility);
  elements.captureMic.addEventListener("change", updateVisibility);

  // Countdown toggle affects seconds visibility
  elements.showCountdown.addEventListener("change", updateVisibility);

  // Output format hint update
  elements.outputFormat.addEventListener("change", () => {
    updateFormatHint(elements.outputFormat.value);
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
    outputFormat: elements.outputFormat.value,
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

  console.log(
    "[Options] Salvando configurações:",
    JSON.stringify(settings, null, 2)
  );
  console.log("[Options] outputFormat:", settings.outputFormat);

  // Valida padrão de nome de arquivo
  const filenameValidation = validateFilenamePattern(settings.filenamePattern);
  if (!filenameValidation.valid) {
    showNotification(filenameValidation.error, "error");
    return;
  }

  try {
    await chrome.storage.local.set({ settings });
    console.log("[Options] Configurações salvas com sucesso!");
    showNotification("Configurações salvas com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    showNotification("Erro ao salvar configurações", "error");
  }
}

function validateFilenamePattern(pattern) {
  if (!pattern || pattern.trim() === "") {
    return { valid: false, error: "O padrão de nome não pode estar vazio" };
  }

  // Caracteres inválidos para nomes de arquivo no Windows
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(pattern)) {
    return {
      valid: false,
      error: 'O padrão contém caracteres inválidos: < > : " / \\ | ? *',
    };
  }

  return { valid: true };
}

async function resetToDefaults() {
  if (!confirm("Tem certeza que deseja restaurar as configurações padrão?")) {
    return;
  }

  try {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    await loadSettings();
    updateVisibility();
    showNotification("Configurações restauradas!", "success");
  } catch (error) {
    console.error("Erro ao restaurar configurações:", error);
    showNotification("Erro ao restaurar configurações", "error");
  }
}

// =============== Notifications ===============
function showNotification(message, type = "info") {
  // Remove notificação existente
  const existing = document.querySelector(".notification");
  if (existing) {
    existing.remove();
  }

  // Cria nova notificação
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button class="notification-close">&times;</button>
  `;

  // Estilo inline para a notificação
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

  // Auto-remove após 3 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);

  // Adiciona keyframes se não existirem
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
