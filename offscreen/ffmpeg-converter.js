// FFmpeg Converter - Converte WebM para MP4 usando FFmpeg.wasm
// Isso garante compatibilidade com editores como DaVinci Resolve

// URLs do FFmpeg.wasm CDN (versão 0.12.10)
const FFMPEG_CORE_URL =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js";
const FFMPEG_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm";

let ffmpegInstance = null;
let ffmpegLoaded = false;
let isLoading = false;

// Importa FFmpeg dinamicamente
async function importFFmpeg() {
  if (window.FFmpeg) return window.FFmpeg;

  // Carrega o módulo FFmpeg via script tag
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.min.js";
    script.onload = () => {
      if (window.FFmpegWASM) {
        resolve(window.FFmpegWASM);
      } else {
        reject(new Error("FFmpeg não carregou corretamente"));
      }
    };
    script.onerror = () => reject(new Error("Falha ao carregar FFmpeg"));
    document.head.appendChild(script);
  });
}

// Importa FFmpeg util
async function importFFmpegUtil() {
  if (window.FFmpegUtil) return window.FFmpegUtil;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js";
    script.onload = () => {
      if (window.FFmpegUtil) {
        resolve(window.FFmpegUtil);
      } else {
        reject(new Error("FFmpeg Util não carregou corretamente"));
      }
    };
    script.onerror = () => reject(new Error("Falha ao carregar FFmpeg Util"));
    document.head.appendChild(script);
  });
}

// Inicializa o FFmpeg
export async function initFFmpeg(onProgress) {
  if (ffmpegLoaded && ffmpegInstance) {
    return ffmpegInstance;
  }

  if (isLoading) {
    // Aguarda carregamento em andamento
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return ffmpegInstance;
  }

  isLoading = true;

  try {
    // Importa os módulos
    const FFmpegModule = await importFFmpeg();
    const FFmpegUtil = await importFFmpegUtil();

    const { FFmpeg } = FFmpegModule;
    const { toBlobURL } = FFmpegUtil;

    ffmpegInstance = new FFmpeg();

    // Log de progresso
    ffmpegInstance.on("log", ({ message }) => {
      console.log("[FFmpeg]", message);
    });

    // Progresso da conversão
    ffmpegInstance.on("progress", ({ progress, time }) => {
      if (onProgress) {
        onProgress(Math.round(progress * 100), time);
      }
    });

    // Carrega o core do FFmpeg usando toBlobURL para evitar problemas de CORS
    await ffmpegInstance.load({
      coreURL: await toBlobURL(FFMPEG_CORE_URL, "text/javascript"),
      wasmURL: await toBlobURL(FFMPEG_WASM_URL, "application/wasm"),
    });

    ffmpegLoaded = true;
    console.log("FFmpeg carregado com sucesso!");
    return ffmpegInstance;
  } catch (error) {
    console.error("Erro ao carregar FFmpeg:", error);
    throw error;
  } finally {
    isLoading = false;
  }
}

// Converte WebM para MP4
export async function convertToMP4(webmBlob, options = {}, onProgress) {
  const { fps = 30 } = options;

  try {
    // Garante que FFmpeg está inicializado
    const ffmpeg = await initFFmpeg(onProgress);

    // Converte blob para Uint8Array
    const webmData = new Uint8Array(await webmBlob.arrayBuffer());

    // Escreve o arquivo de entrada no sistema de arquivos virtual
    await ffmpeg.writeFile("input.webm", webmData);

    console.log("Iniciando conversão WebM -> MP4...");
    console.log(`Configurações: FPS=${fps}`);

    // Executa a conversão
    // -r: Define taxa de quadros constante (CFR)
    // -c:v libx264: Codec de vídeo H.264
    // -preset fast: Balanço entre velocidade e qualidade
    // -crf 23: Qualidade (18-28 é bom, menor = melhor)
    // -c:a aac: Codec de áudio AAC
    // -b:a 128k: Bitrate de áudio
    // -movflags +faststart: Otimiza para streaming/reprodução
    // -vsync cfr: Força taxa de quadros constante
    await ffmpeg.exec([
      "-i",
      "input.webm",
      "-r",
      fps.toString(),
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-vsync",
      "cfr",
      "-pix_fmt",
      "yuv420p", // Compatibilidade máxima
      "output.mp4",
    ]);

    console.log("Conversão concluída!");

    // Lê o arquivo de saída
    const mp4Data = await ffmpeg.readFile("output.mp4");

    // Limpa arquivos temporários
    await ffmpeg.deleteFile("input.webm");
    await ffmpeg.deleteFile("output.mp4");

    // Cria blob do MP4
    const mp4Blob = new Blob([mp4Data.buffer], { type: "video/mp4" });

    console.log(
      `Tamanho original: ${(webmBlob.size / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`Tamanho MP4: ${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB`);

    return mp4Blob;
  } catch (error) {
    console.error("Erro na conversão:", error);
    throw error;
  }
}

// Verifica se FFmpeg está disponível
export function isFFmpegLoaded() {
  return ffmpegLoaded;
}

// Limpa FFmpeg da memória
export async function terminateFFmpeg() {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate();
    } catch (e) {
      // Ignora erros de término
    }
    ffmpegInstance = null;
    ffmpegLoaded = false;
  }
}
