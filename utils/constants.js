// Constantes compartilhadas entre os módulos da extensão

export const QUALITY_PRESETS = {
  "720p": { width: 1280, height: 720, label: "720p HD" },
  "1080p": { width: 1920, height: 1080, label: "1080p Full HD" },
  "1440p": { width: 2560, height: 1440, label: "1440p QHD" },
  "4k": { width: 3840, height: 2160, label: "4K Ultra HD" },
};

export const FPS_OPTIONS = [30, 60];

export const CODEC_OPTIONS = {
  vp9: { mimeType: "video/webm;codecs=vp9", label: "VP9 (Melhor qualidade)" },
  vp8: { mimeType: "video/webm;codecs=vp8", label: "VP8 (Mais compatível)" },
  h264: { mimeType: "video/webm;codecs=h264", label: "H.264 (Hardware)" },
};

export const DEFAULT_SETTINGS = {
  quality: "1080p",
  fps: 30,
  codec: "vp9",
  captureAudio: true,
  captureMic: false,
  micVolume: 100,
  tabVolume: 100,
  showCountdown: true,
  countdownSeconds: 3,
  autoSave: true,
  filenamePattern: "gravacao_{date}_{time}",
};

export const RECORDING_STATE = {
  IDLE: "idle",
  COUNTDOWN: "countdown",
  RECORDING: "recording",
  PAUSED: "paused",
  STOPPING: "stopping",
};

export const MESSAGE_TYPES = {
  // Popup -> Background
  START_RECORDING: "START_RECORDING",
  STOP_RECORDING: "STOP_RECORDING",
  PAUSE_RECORDING: "PAUSE_RECORDING",
  RESUME_RECORDING: "RESUME_RECORDING",
  GET_STATE: "GET_STATE",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",

  // Background -> Offscreen
  OFFSCREEN_START: "OFFSCREEN_START",
  OFFSCREEN_STOP: "OFFSCREEN_STOP",
  OFFSCREEN_PAUSE: "OFFSCREEN_PAUSE",
  OFFSCREEN_RESUME: "OFFSCREEN_RESUME",

  // Offscreen -> Background
  RECORDING_STARTED: "RECORDING_STARTED",
  RECORDING_STOPPED: "RECORDING_STOPPED",
  RECORDING_ERROR: "RECORDING_ERROR",
  RECORDING_DATA: "RECORDING_DATA",

  // Background -> Popup
  STATE_UPDATE: "STATE_UPDATE",
  TIME_UPDATE: "TIME_UPDATE",
};

export const CAPTURE_SOURCES = {
  SCREEN: "screen",
  WINDOW: "window",
  TAB: "tab",
};

// Função para formatar tempo em HH:MM:SS
export function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

// Função para gerar nome de arquivo
export function generateFilename(pattern) {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");

  return pattern.replace("{date}", date).replace("{time}", time) + ".webm";
}
