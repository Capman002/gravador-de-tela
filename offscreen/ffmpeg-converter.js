// FFmpeg Converter - Converte WebM para MP4 usando FFmpeg.wasm
// Isso garante compatibilidade com editores como DaVinci Resolve

let ffmpegInstance = null;
let ffmpegLoaded = false;
let isLoading = false;
let FFmpegModule = null;
let FFmpegUtilModule = null;

// URLs do FFmpeg.wasm CDN (versão 0.12.10)
const FFMPEG_CDN_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg";
const FFMPEG_VERSION = "0.12.10";
const CORE_VERSION = "0.12.10";
const UTIL_VERSION = "0.12.1";

// Carrega script dinamicamente
function loadScript(url) {
  return new Promise((resolve, reject) => {
    // Verifica se já foi carregado
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar: ${url}`));
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
    if (ffmpegInstance) return ffmpegInstance;
  }

  isLoading = true;

  try {
    console.log("[FFmpeg] Carregando módulos...");

    // Carrega os scripts do CDN
    await loadScript(
      `${FFMPEG_CDN_BASE}/ffmpeg@${FFMPEG_VERSION}/dist/umd/ffmpeg.min.js`
    );
    await loadScript(
      `${FFMPEG_CDN_BASE}/util@${UTIL_VERSION}/dist/umd/index.min.js`
    );

    // Acessa os módulos globais
    // O ffmpeg.wasm UMD expõe como FFmpegWASM ou FFmpeg
    const FFmpegLib = window.FFmpegWASM || window.FFmpeg;
    const FFmpegUtil = window.FFmpegUtil;

    if (!FFmpegLib || !FFmpegLib.FFmpeg) {
      throw new Error("FFmpeg não foi carregado corretamente");
    }

    if (!FFmpegUtil || !FFmpegUtil.toBlobURL) {
      throw new Error("FFmpeg Util não foi carregado corretamente");
    }

    const { FFmpeg } = FFmpegLib;
    const { toBlobURL } = FFmpegUtil;

    ffmpegInstance = new FFmpeg();

    // Log de progresso
    ffmpegInstance.on("log", ({ message }) => {
      console.log("[FFmpeg]", message);
    });

    // Progresso da conversão
    ffmpegInstance.on("progress", ({ progress, time }) => {
      const percent = Math.round((progress || 0) * 100);
      console.log(`[FFmpeg] Progresso: ${percent}%`);
      if (onProgress) {
        onProgress(percent, time);
      }
    });

    console.log("[FFmpeg] Baixando core WebAssembly (~31MB)...");

    // Carrega o core do FFmpeg
    const coreURL = `${FFMPEG_CDN_BASE}/core@${CORE_VERSION}/dist/umd/ffmpeg-core.js`;
    const wasmURL = `${FFMPEG_CDN_BASE}/core@${CORE_VERSION}/dist/umd/ffmpeg-core.wasm`;

    await ffmpegInstance.load({
      coreURL: await toBlobURL(coreURL, "text/javascript"),
      wasmURL: await toBlobURL(wasmURL, "application/wasm"),
    });

    ffmpegLoaded = true;
    console.log("[FFmpeg] Carregado com sucesso!");
    return ffmpegInstance;
  } catch (error) {
    console.error("[FFmpeg] Erro ao carregar:", error);
    ffmpegInstance = null;
    ffmpegLoaded = false;
    throw error;
  } finally {
    isLoading = false;
  }
}

// Converte WebM para MP4
export async function convertToMP4(webmBlob, options = {}, onProgress) {
  const { fps = 60 } = options;

  try {
    console.log("[FFmpeg] Iniciando conversão WebM → MP4...");
    console.log(
      `[FFmpeg] Tamanho entrada: ${(webmBlob.size / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`[FFmpeg] FPS alvo: ${fps}`);

    // Garante que FFmpeg está inicializado
    const ffmpeg = await initFFmpeg(onProgress);

    // Converte blob para Uint8Array
    const webmData = new Uint8Array(await webmBlob.arrayBuffer());

    // Escreve o arquivo de entrada no sistema de arquivos virtual
    await ffmpeg.writeFile("input.webm", webmData);

    console.log("[FFmpeg] Executando conversão...");

    // Executa a conversão com parâmetros otimizados para DaVinci Resolve
    // -r: Define taxa de quadros de SAÍDA (CFR)
    // -c:v libx264: Codec de vídeo H.264
    // -preset medium: Balanço entre velocidade e qualidade
    // -crf 18: Alta qualidade (menor = melhor, 18-23 é bom)
    // -c:a aac: Codec de áudio AAC
    // -b:a 192k: Bitrate de áudio
    // -movflags +faststart: Otimiza para reprodução
    // -pix_fmt yuv420p: Formato de pixel compatível
    // -vsync cfr: Força taxa de quadros constante
    await ffmpeg.exec([
      "-i",
      "input.webm",
      "-r",
      fps.toString(),
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

    console.log("[FFmpeg] Conversão concluída!");

    // Lê o arquivo de saída
    const mp4Data = await ffmpeg.readFile("output.mp4");

    // Limpa arquivos temporários
    try {
      await ffmpeg.deleteFile("input.webm");
      await ffmpeg.deleteFile("output.mp4");
    } catch (e) {
      // Ignora erros de limpeza
    }

    // Cria blob do MP4
    const mp4Blob = new Blob([mp4Data.buffer], { type: "video/mp4" });

    console.log(
      `[FFmpeg] Tamanho MP4: ${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB`
    );

    return mp4Blob;
  } catch (error) {
    console.error("[FFmpeg] Erro na conversão:", error);
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
      console.log("[FFmpeg] Terminado");
    } catch (e) {
      // Ignora erros de término
    }
    ffmpegInstance = null;
    ffmpegLoaded = false;
  }
}
