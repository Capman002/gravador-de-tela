// Offscreen Document - Processa gravação de mídia em background

import {
  QUALITY_PRESETS,
  CODEC_OPTIONS,
  MESSAGE_TYPES,
} from "../utils/constants.js";

let mediaRecorder = null;
let recordedChunks = [];
let displayStream = null;
let micStream = null;
let combinedStream = null;
let audioContext = null;

// ============ STREAM MANAGEMENT ============

async function getDisplayMediaStream(options) {
  const qualityPreset =
    QUALITY_PRESETS[options.quality] || QUALITY_PRESETS["1080p"];

  const constraints = {
    video: {
      width: { ideal: qualityPreset.width, max: qualityPreset.width },
      height: { ideal: qualityPreset.height, max: qualityPreset.height },
      frameRate: { ideal: options.fps || 30, max: 60 },
    },
    audio: options.captureAudio
      ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        }
      : false,
  };

  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);
    return displayStream;
  } catch (error) {
    console.error("Erro ao obter stream de display:", error);
    throw error;
  }
}

async function getMicrophoneStream(options) {
  if (!options.captureMic) return null;

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    return micStream;
  } catch (error) {
    console.error("Erro ao obter stream do microfone:", error);
    // Não falha completamente, apenas não terá áudio do mic
    return null;
  }
}

function combineAudioStreams(displayStream, micStream, options) {
  // Se não tiver ambos os streams de áudio, retorna o que tiver
  const displayAudio = displayStream.getAudioTracks();
  const micAudio = micStream?.getAudioTracks() || [];

  if (displayAudio.length === 0 && micAudio.length === 0) {
    // Sem áudio, retorna apenas vídeo
    return new MediaStream(displayStream.getVideoTracks());
  }

  if (displayAudio.length === 0) {
    // Apenas mic
    return new MediaStream([...displayStream.getVideoTracks(), ...micAudio]);
  }

  if (micAudio.length === 0) {
    // Apenas áudio da aba/tela
    return displayStream;
  }

  // Combina ambos os áudios usando AudioContext
  try {
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    // Stream da aba/tela
    const displaySource = audioContext.createMediaStreamSource(
      new MediaStream(displayAudio)
    );
    const displayGain = audioContext.createGain();
    displayGain.gain.value = (options.tabVolume || 100) / 100;
    displaySource.connect(displayGain);
    displayGain.connect(destination);

    // Stream do microfone
    const micSource = audioContext.createMediaStreamSource(
      new MediaStream(micAudio)
    );
    const micGain = audioContext.createGain();
    micGain.gain.value = (options.micVolume || 100) / 100;
    micSource.connect(micGain);
    micGain.connect(destination);

    // Combina vídeo + áudio mixado
    combinedStream = new MediaStream([
      ...displayStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    return combinedStream;
  } catch (error) {
    console.error("Erro ao combinar streams de áudio:", error);
    // Fallback: retorna stream original
    return displayStream;
  }
}

// ============ RECORDING CONTROL ============

async function startRecording(options) {
  try {
    recordedChunks = [];

    // Obtém streams
    const display = await getDisplayMediaStream(options);
    const mic = await getMicrophoneStream(options);

    // Combina streams se necessário
    const finalStream = combineAudioStreams(display, mic, options);

    // Detecta codec suportado
    const codecInfo = CODEC_OPTIONS[options.codec] || CODEC_OPTIONS["vp9"];
    let mimeType = codecInfo.mimeType;

    // Verifica suporte
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      // Fallback para VP8
      mimeType = "video/webm;codecs=vp8";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }
    }

    // Calcula bitrate baseado na qualidade
    const qualityPreset =
      QUALITY_PRESETS[options.quality] || QUALITY_PRESETS["1080p"];
    const videoBitrate = calculateBitrate(qualityPreset, options.fps);

    // Cria MediaRecorder
    mediaRecorder = new MediaRecorder(finalStream, {
      mimeType: mimeType,
      videoBitsPerSecond: videoBitrate,
      audioBitsPerSecond: 128000,
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      await handleRecordingStop(options);
    };

    mediaRecorder.onerror = (event) => {
      console.error("Erro no MediaRecorder:", event.error);
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.RECORDING_ERROR,
        error: event.error?.message || "Erro desconhecido",
      });
    };

    // Handler quando o usuário para o compartilhamento
    display.getVideoTracks()[0].onended = () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        stopRecording();
      }
    };

    // Inicia gravação (coleta dados a cada segundo)
    mediaRecorder.start(1000);

    return { success: true };
  } catch (error) {
    console.error("Erro ao iniciar gravação:", error);
    cleanupStreams();
    return { success: false, error: error.message };
  }
}

function calculateBitrate(quality, fps) {
  // Bitrates aproximados para boa qualidade
  const baseBitrates = {
    720: 3000000, // 3 Mbps
    1080: 6000000, // 6 Mbps
    1440: 12000000, // 12 Mbps
    2160: 25000000, // 25 Mbps
  };

  const baseBitrate = baseBitrates[quality.height] || 6000000;

  // Ajusta para FPS
  const fpsMultiplier = fps === 60 ? 1.5 : 1;

  return Math.floor(baseBitrate * fpsMultiplier);
}

async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    return { success: false, error: "Nenhuma gravação ativa" };
  }

  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      const result = await handleRecordingStop();
      resolve(result);
    };

    mediaRecorder.stop();
  });
}

async function handleRecordingStop(options = {}) {
  try {
    // Cria blob do vídeo
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const blobUrl = URL.createObjectURL(blob);

    // Limpa recursos
    cleanupStreams();

    // Notifica background
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RECORDING_STOPPED,
      blob: blobUrl,
      size: blob.size,
    });

    return { success: true, blobUrl };
  } catch (error) {
    console.error("Erro ao finalizar gravação:", error);
    return { success: false, error: error.message };
  }
}

function pauseRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.pause();
    return { success: true };
  }
  return { success: false, error: "Não é possível pausar" };
}

function resumeRecording() {
  if (mediaRecorder && mediaRecorder.state === "paused") {
    mediaRecorder.resume();
    return { success: true };
  }
  return { success: false, error: "Não é possível retomar" };
}

function cleanupStreams() {
  // Para todas as tracks
  if (displayStream) {
    displayStream.getTracks().forEach((track) => track.stop());
    displayStream = null;
  }

  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }

  if (combinedStream) {
    combinedStream.getTracks().forEach((track) => track.stop());
    combinedStream = null;
  }

  // Fecha AudioContext
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  mediaRecorder = null;
  recordedChunks = [];
}

// ============ MESSAGE HANDLERS ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    let response;

    switch (message.type) {
      case MESSAGE_TYPES.OFFSCREEN_START:
        response = await startRecording(message.options);
        break;

      case MESSAGE_TYPES.OFFSCREEN_STOP:
        response = await stopRecording();
        break;

      case MESSAGE_TYPES.OFFSCREEN_PAUSE:
        response = pauseRecording();
        break;

      case MESSAGE_TYPES.OFFSCREEN_RESUME:
        response = resumeRecording();
        break;

      default:
        response = { error: "Comando não reconhecido" };
    }

    sendResponse(response);
  })();

  return true;
});

console.log("Offscreen document carregado");
