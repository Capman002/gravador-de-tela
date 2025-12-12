// FFmpeg Converter - Executa FFmpeg.wasm diretamente no offscreen document
// O offscreen tem acesso ao DOM, então podemos carregar scripts

let ffmpeg = null;
let loaded = false;
let isLoading = false;

// Carrega o script FFmpeg
async function loadFFmpegScript() {
  return new Promise((resolve, reject) => {
    if (window.FFmpegWASM) {
      resolve();
      return;
    }

    console.log("[FFmpeg] Carregando script...");
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("ffmpeg-core/ffmpeg.min.js");
    script.onload = () => {
      console.log("[FFmpeg] Script carregado!");
      resolve();
    };
    script.onerror = (e) => {
      console.error("[FFmpeg] Erro ao carregar script:", e);
      reject(new Error("Falha ao carregar ffmpeg.min.js"));
    };
    document.head.appendChild(script);
  });
}

// Inicializa o FFmpeg
export async function initFFmpeg(onProgress) {
  if (loaded && ffmpeg) {
    console.log("[FFmpeg] Já carregado, reutilizando");
    return ffmpeg;
  }

  if (isLoading) {
    console.log("[FFmpeg] Aguardando carregamento...");
    while (isLoading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (ffmpeg) return ffmpeg;
  }

  isLoading = true;
  console.log("[FFmpeg] Iniciando...");

  try {
    // Carrega o script
    await loadFFmpegScript();

    if (!window.FFmpegWASM) {
      throw new Error("FFmpegWASM não disponível após carregar script");
    }

    const { FFmpeg } = window.FFmpegWASM;
    ffmpeg = new FFmpeg();

    // Log
    ffmpeg.on("log", ({ message }) => {
      console.log("[FFmpeg Log]", message);
    });

    // Progresso
    ffmpeg.on("progress", ({ progress }) => {
      const percent = Math.round((progress || 0) * 100);
      console.log(`[FFmpeg] Progresso: ${percent}%`);
      if (onProgress) onProgress(percent);
    });

    console.log("[FFmpeg] Carregando core...");

    // Carrega core local
    const coreURL = chrome.runtime.getURL("ffmpeg-core/ffmpeg-core.js");
    const wasmURL = chrome.runtime.getURL("ffmpeg-core/ffmpeg-core.wasm");

    console.log("[FFmpeg] Core URL:", coreURL);
    console.log("[FFmpeg] WASM URL:", wasmURL);

    await ffmpeg.load({ coreURL, wasmURL });

    loaded = true;
    console.log("[FFmpeg] ✅ Pronto!");
    return ffmpeg;
  } catch (error) {
    console.error("[FFmpeg] ❌ Erro:", error);
    ffmpeg = null;
    loaded = false;
    throw error;
  } finally {
    isLoading = false;
  }
}

// Converte WebM para MP4
export async function convertToMP4(webmBlob, options = {}, onProgress) {
  const { fps = 60 } = options;

  console.log("[FFmpeg] ═══════════════════════════════════");
  console.log("[FFmpeg] Conversão WebM → MP4");
  console.log(
    `[FFmpeg] Entrada: ${(webmBlob.size / 1024 / 1024).toFixed(2)} MB`
  );
  console.log(`[FFmpeg] FPS: ${fps}`);
  console.log("[FFmpeg] ═══════════════════════════════════");

  try {
    const ff = await initFFmpeg(onProgress);

    // Escreve arquivo de entrada
    const webmData = new Uint8Array(await webmBlob.arrayBuffer());
    console.log("[FFmpeg] Escrevendo input...");
    await ff.writeFile("input.webm", webmData);

    // Converte
    console.log("[FFmpeg] Executando conversão...");
    await ff.exec([
      "-i",
      "input.webm",
      "-r",
      String(fps),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-profile:v",
      "high",
      "-level",
      "4.2",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      "-vsync",
      "cfr",
      "output.mp4",
    ]);

    console.log("[FFmpeg] Lendo output...");
    const mp4Data = await ff.readFile("output.mp4");

    // Limpa
    try {
      await ff.deleteFile("input.webm");
      await ff.deleteFile("output.mp4");
    } catch (e) {}

    const mp4Blob = new Blob([mp4Data.buffer], { type: "video/mp4" });

    console.log("[FFmpeg] ═══════════════════════════════════");
    console.log(
      `[FFmpeg] ✅ Saída: ${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB`
    );
    console.log("[FFmpeg] ═══════════════════════════════════");

    return mp4Blob;
  } catch (error) {
    console.error("[FFmpeg] ❌ Erro na conversão:", error);
    throw error;
  }
}

export function isFFmpegLoaded() {
  return loaded;
}

export async function terminateFFmpeg() {
  if (ffmpeg) {
    try {
      ffmpeg.terminate();
    } catch (e) {}
    ffmpeg = null;
    loaded = false;
    console.log("[FFmpeg] Terminado");
  }
}
