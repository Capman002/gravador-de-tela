// Offscreen Document - GravaÃ§Ã£o MP4 H.264 CFR via WebCodecs + mp4-muxer

import {
  QUALITY_PRESETS,
  RECORDING_FORMATS,
  MESSAGE_TYPES,
} from "../utils/constants.js";

// Importa mp4-muxer (serÃ¡ carregado via script tag no HTML)
// O Mp4Muxer estarÃ¡ disponÃ­vel globalmente

// Estado da gravaÃ§Ã£o
let isRecording = false;
let isPaused = false;
let displayStream = null;
let micStream = null;
let audioContext = null;

// WebCodecs
let videoEncoder = null;
let audioEncoder = null;
let muxer = null;
let muxerTarget = null;

// MediaRecorder fallback (para WebM)
let mediaRecorder = null;
let recordedChunks = [];

// Contadores
let frameCount = 0;
let currentOptions = null;

// ============ STREAM MANAGEMENT ============

async function getDisplayMediaStream(options) {
  const qualityPreset =
    QUALITY_PRESETS[options.quality] || QUALITY_PRESETS["1080p"];

  const surfaceMap = {
    screen: "monitor",
    window: "window",
    tab: "browser",
  };

  const displaySurface = surfaceMap[options.source] || "monitor";

  const constraints = {
    video: {
      width: { ideal: qualityPreset.width, max: qualityPreset.width },
      height: { ideal: qualityPreset.height, max: qualityPreset.height },
      frameRate: { ideal: options.fps || 30, max: 60 },
      displaySurface: displaySurface,
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
    preferCurrentTab: options.source === "tab",
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
        sampleRate: 48000,
        channelCount: 1,
      },
      video: false,
    });
    return micStream;
  } catch (error) {
    console.error("Erro ao obter stream do microfone:", error);
    return null;
  }
}

// ============ WEBCODECS RECORDING (MP4) ============

async function startWebCodecsRecording(options) {
  const qualityPreset =
    QUALITY_PRESETS[options.quality] || QUALITY_PRESETS["1080p"];
  const fps = options.fps || 60;
  const width = qualityPreset.width;
  const height = qualityPreset.height;


  // ObtÃ©m streams
  const display = await getDisplayMediaStream(options);
  const mic = await getMicrophoneStream(options);

  // Calcula bitrate
  const videoBitrate = calculateBitrate(qualityPreset, fps);
  const audioBitrate = 128000;


  // Cria o target do muxer (ArrayBuffer)
  muxerTarget = new Mp4Muxer.ArrayBufferTarget();

  // Configura o muxer
  const hasAudio = display.getAudioTracks().length > 0 || mic;

  muxer = new Mp4Muxer.Muxer({
    target: muxerTarget,
    video: {
      codec: "avc",
      width: width,
      height: height,
    },
    audio: hasAudio
      ? {
          codec: "aac",
          numberOfChannels: 2,
          sampleRate: 48000,
        }
      : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  // Configura o encoder de vÃ­deo
  videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      console.error("[WebCodecs] Erro no VideoEncoder:", e);
      sendError(e.message);
    },
  });

  // H.264 High Profile
  // avc1.640033 = High Profile, Level 5.1 (4K 60fps)
  // avc1.64002A = High Profile, Level 4.2 (4K 30fps ou 1080p 60fps)
  const codecLevel = height > 1080 && fps > 30 ? "640033" : "64002A";

  videoEncoder.configure({
    codec: `avc1.${codecLevel}`,
    width: width,
    height: height,
    bitrate: videoBitrate,
    framerate: fps,
    latencyMode: "quality",
    avc: { format: "avc" },
  });

  // Configura encoder de Ã¡udio se necessÃ¡rio
  if (hasAudio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        muxer.addAudioChunk(chunk, meta);
      },
      error: (e) => {
        console.error("[WebCodecs] Erro no AudioEncoder:", e);
      },
    });

    audioEncoder.configure({
      codec: "mp4a.40.2", // AAC-LC
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: audioBitrate,
    });
  }

  // Processa vÃ­deo
  const videoTrack = display.getVideoTracks()[0];
  const processor = new MediaStreamTrackProcessor({ track: videoTrack });
  const reader = processor.readable.getReader();

  // Handle quando usuÃ¡rio para o compartilhamento
  videoTrack.onended = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  // Processa Ã¡udio se tiver
  if (hasAudio) {
    const audioTracks = [
      ...display.getAudioTracks(),
      ...(mic ? mic.getAudioTracks() : []),
    ];

    if (audioTracks.length > 0) {
      processAudio(audioTracks, options);
    }
  }

  isRecording = true;
  isPaused = false;
  frameCount = 0;

  // Loop de leitura de frames
  const frameDuration = 1000000 / fps; // Em microsegundos
  let expectedTimestamp = 0;

  const readFrames = async () => {
    try {
      while (isRecording) {
        const { value: frame, done } = await reader.read();

        if (done || !isRecording) break;

        if (!isPaused) {
          // Usa timestamp fixo para CFR
          const timestamp = frameCount * frameDuration;

          videoEncoder.encode(frame, {
            keyFrame: frameCount % (fps * 2) === 0, // Keyframe a cada 2 segundos
          });

          frameCount++;
        }

        frame.close();
      }
    } catch (error) {
      console.error("[WebCodecs] Erro no loop de frames:", error);
    }
  };

  readFrames();

  return { success: true };
}

async function processAudio(audioTracks, options) {
  try {
    audioContext = new AudioContext({ sampleRate: 48000 });

    const destination = audioContext.createMediaStreamDestination();

    for (const track of audioTracks) {
      const source = audioContext.createMediaStreamSource(
        new MediaStream([track])
      );
      const gain = audioContext.createGain();

      // Aplica volume baseado no tipo de track
      if (track.label.includes("microphone") || track.kind === "audioinput") {
        gain.gain.value = (options.micVolume || 100) / 100;
      } else {
        gain.gain.value = (options.tabVolume || 100) / 100;
      }

      source.connect(gain);
      gain.connect(destination);
    }

    // Cria um processador de Ã¡udio
    const audioTrack = destination.stream.getAudioTracks()[0];

    // Usa MediaStreamTrackProcessor para Ã¡udio tambÃ©m
    // Nota: Isso pode nÃ£o estar disponÃ­vel em todos os navegadores
    if (typeof MediaStreamTrackProcessor !== "undefined") {
      const audioProcessor = new MediaStreamTrackProcessor({
        track: audioTrack,
      });
      const audioReader = audioProcessor.readable.getReader();

      const readAudio = async () => {
        try {
          while (isRecording && audioEncoder) {
            const { value: audioData, done } = await audioReader.read();

            if (done || !isRecording) break;

            if (!isPaused && audioEncoder.state === "configured") {
              audioEncoder.encode(audioData);
            }

            audioData.close();
          }
        } catch (error) {
          console.error("[WebCodecs] Erro no loop de Ã¡udio:", error);
        }
      };

      readAudio();
    }
  } catch (error) {
    console.error("[WebCodecs] Erro ao processar Ã¡udio:", error);
  }
}

async function stopWebCodecsRecording() {
  isRecording = false;

  try {
    // Finaliza encoders
    if (videoEncoder && videoEncoder.state !== "closed") {
      await videoEncoder.flush();
      videoEncoder.close();
    }

    if (audioEncoder && audioEncoder.state !== "closed") {
      await audioEncoder.flush();
      audioEncoder.close();
    }

    // Finaliza muxer
    muxer.finalize();

    // ObtÃ©m o arquivo final
    const buffer = muxerTarget.buffer;
    const blob = new Blob([buffer], { type: "video/mp4" });

      size: blob.size,
      frames: frameCount,
    });

    // Limpa recursos
    cleanupStreams();

    // Cria URL e notifica
    const blobUrl = URL.createObjectURL(blob);

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RECORDING_STOPPED,
      blob: blobUrl,
      extension: ".mp4",
      size: blob.size,
    });

    return { success: true };
  } catch (error) {
    console.error("[WebCodecs] Erro ao parar gravaÃ§Ã£o:", error);
    cleanupStreams();
    return { success: false, error: error.message };
  }
}

// ============ MEDIARECORDER FALLBACK (WebM) ============

async function startMediaRecorderRecording(options) {
  recordedChunks = [];

  const display = await getDisplayMediaStream(options);
  const mic = await getMicrophoneStream(options);

  // Combina streams
  let finalStream = display;
  if (mic && display.getAudioTracks().length > 0) {
    // Combina Ã¡udios
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    const displaySource = audioContext.createMediaStreamSource(
      new MediaStream(display.getAudioTracks())
    );
    displaySource.connect(destination);

    const micSource = audioContext.createMediaStreamSource(mic);
    micSource.connect(destination);

    finalStream = new MediaStream([
      ...display.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
  } else if (mic) {
    finalStream = new MediaStream([
      ...display.getVideoTracks(),
      ...mic.getAudioTracks(),
    ]);
  }

  const qualityPreset =
    QUALITY_PRESETS[options.quality] || QUALITY_PRESETS["1080p"];
  const videoBitrate = calculateBitrate(qualityPreset, options.fps);

  // Tenta VP9, fallback para VP8
  let mimeType = "video/webm;codecs=vp9";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm;codecs=vp8";
  }

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
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    cleanupStreams();

    const blobUrl = URL.createObjectURL(blob);
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RECORDING_STOPPED,
      blob: blobUrl,
      extension: ".webm",
      size: blob.size,
    });
  };

  mediaRecorder.onerror = (event) => {
    console.error("Erro no MediaRecorder:", event.error);
    sendError(event.error?.message || "Erro desconhecido");
  };

  // Handler quando usuÃ¡rio para o compartilhamento
  display.getVideoTracks()[0].onended = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      stopMediaRecorderRecording();
    }
  };

  mediaRecorder.start(1000);
  isRecording = true;

  return { success: true };
}

async function stopMediaRecorderRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    return { success: false, error: "Nenhuma gravaÃ§Ã£o ativa" };
  }

  return new Promise((resolve) => {
    const originalOnstop = mediaRecorder.onstop;
    mediaRecorder.onstop = async (event) => {
      if (originalOnstop) originalOnstop(event);
      resolve({ success: true });
    };
    mediaRecorder.stop();
    isRecording = false;
  });
}

// ============ HELPERS ============

function calculateBitrate(quality, fps) {
  const baseBitrates = {
    720: 4000000,
    1080: 8000000,
    1440: 16000000,
    2160: 35000000,
  };

  const baseBitrate = baseBitrates[quality.height] || 8000000;
  const fpsMultiplier = fps === 60 ? 1.5 : 1;

  return Math.floor(baseBitrate * fpsMultiplier);
}

function cleanupStreams() {
  if (displayStream) {
    displayStream.getTracks().forEach((track) => track.stop());
    displayStream = null;
  }

  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  videoEncoder = null;
  audioEncoder = null;
  muxer = null;
  muxerTarget = null;
  mediaRecorder = null;
  recordedChunks = [];
}

function sendError(message) {
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.RECORDING_ERROR,
    error: message,
  });
}

// ============ PUBLIC API ============

async function startRecording(options) {
  currentOptions = options;
  const format = RECORDING_FORMATS[options.format] || RECORDING_FORMATS.mp4;


  // Verifica suporte a WebCodecs
  const webCodecsSupported =
    typeof VideoEncoder !== "undefined" &&
    typeof MediaStreamTrackProcessor !== "undefined";

  if (format.useWebCodecs && webCodecsSupported) {
    return startWebCodecsRecording(options);
  } else {
    return startMediaRecorderRecording(options);
  }
}

async function stopRecording() {
  const format =
    RECORDING_FORMATS[currentOptions?.format] || RECORDING_FORMATS.mp4;

  if (format.useWebCodecs && videoEncoder) {
    return stopWebCodecsRecording();
  } else if (mediaRecorder) {
    return stopMediaRecorderRecording();
  }

  return { success: false, error: "Nenhuma gravaÃ§Ã£o ativa" };
}

function pauseRecording() {
  isPaused = true;
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.pause();
  }
  return { success: true };
}

function resumeRecording() {
  isPaused = false;
  if (mediaRecorder && mediaRecorder.state === "paused") {
    mediaRecorder.resume();
  }
  return { success: true };
}

// ============ MESSAGE HANDLING ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    let response;

    switch (message.type) {
      case MESSAGE_TYPES.OFFSCREEN_START:
        response = await startRecording(message.options);
        if (response.success) {
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.RECORDING_STARTED,
          });
        } else {
          sendError(response.error);
        }
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
        response = { error: "Tipo de mensagem desconhecido" };
    }

    sendResponse(response);
  })();

  return true;
});

