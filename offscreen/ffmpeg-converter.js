// FFmpeg Converter - Comunicação com sandbox via iframe
// O FFmpeg.wasm roda dentro de um iframe sandbox com CSP permissivo

let sandboxFrame = null;
let sandboxReady = false;
let messageId = 0;
let pendingMessages = new Map();

// Cria o iframe sandbox
function createSandbox() {
  return new Promise((resolve, reject) => {
    if (sandboxFrame && sandboxReady) {
      resolve();
      return;
    }

    console.log("[FFmpeg] Criando iframe sandbox...");

    // Remove iframe antigo se existir
    if (sandboxFrame) {
      sandboxFrame.remove();
    }

    sandboxFrame = document.createElement("iframe");
    sandboxFrame.src = chrome.runtime.getURL("offscreen/ffmpeg-sandbox.html");
    sandboxFrame.style.display = "none";
    sandboxFrame.id = "ffmpeg-sandbox";

    // Timeout para erro
    const timeout = setTimeout(() => {
      reject(new Error("Timeout ao criar sandbox"));
    }, 30000);

    // Escuta a mensagem READY do sandbox
    const readyHandler = (event) => {
      if (event.data?.type === "READY") {
        clearTimeout(timeout);
        window.removeEventListener("message", readyHandler);
        sandboxReady = true;
        console.log("[FFmpeg] Sandbox pronto!");
        resolve();
      }
    };

    window.addEventListener("message", readyHandler);
    document.body.appendChild(sandboxFrame);
  });
}

// Escuta mensagens do sandbox
window.addEventListener("message", (event) => {
  const { id, success, result, error, type, progress } = event.data;

  // Mensagem de progresso
  if (type === "PROGRESS") {
    console.log(`[FFmpeg] Progresso: ${progress}%`);
    return;
  }

  // Resposta a uma mensagem pendente
  if (id !== undefined && pendingMessages.has(id)) {
    const { resolve, reject } = pendingMessages.get(id);
    pendingMessages.delete(id);

    if (success) {
      resolve(result);
    } else {
      reject(new Error(error || "Erro desconhecido no sandbox"));
    }
  }
});

// Envia mensagem para o sandbox e aguarda resposta
function sendToSandbox(type, data = {}) {
  return new Promise((resolve, reject) => {
    if (!sandboxFrame || !sandboxReady) {
      reject(new Error("Sandbox não está pronto"));
      return;
    }

    const id = messageId++;
    pendingMessages.set(id, { resolve, reject });

    // Timeout
    setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id);
        reject(new Error(`Timeout na operação: ${type}`));
      }
    }, 300000); // 5 minutos para conversões longas

    sandboxFrame.contentWindow.postMessage({ type, id, data }, "*");
  });
}

// Inicializa o FFmpeg (cria sandbox e carrega)
export async function initFFmpeg(onProgress) {
  console.log("[FFmpeg] Inicializando...");

  await createSandbox();

  const result = await sendToSandbox("INIT");
  console.log("[FFmpeg] Inicializado:", result);

  return result;
}

// Converte WebM para MP4
export async function convertToMP4(webmBlob, options = {}, onProgress) {
  const { fps = 60 } = options;

  console.log("[FFmpeg] ========================================");
  console.log("[FFmpeg] Iniciando conversão WebM → MP4");
  console.log(
    `[FFmpeg] Tamanho: ${(webmBlob.size / 1024 / 1024).toFixed(2)} MB`
  );
  console.log(`[FFmpeg] FPS: ${fps}`);
  console.log("[FFmpeg] ========================================");

  try {
    // Garante que sandbox está pronto
    await createSandbox();
    await sendToSandbox("INIT");

    // Converte blob para array
    const arrayBuffer = await webmBlob.arrayBuffer();
    const webmData = Array.from(new Uint8Array(arrayBuffer));

    console.log(`[FFmpeg] Enviando ${webmData.length} bytes para sandbox...`);

    // Envia para conversão
    const result = await sendToSandbox("CONVERT", { webmData, fps });

    // Reconstrói o blob MP4
    const mp4Blob = new Blob([new Uint8Array(result.mp4Data)], {
      type: "video/mp4",
    });

    console.log("[FFmpeg] ========================================");
    console.log("[FFmpeg] ✅ Conversão concluída!");
    console.log(
      `[FFmpeg] Tamanho MP4: ${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB`
    );
    console.log("[FFmpeg] ========================================");

    return mp4Blob;
  } catch (error) {
    console.error("[FFmpeg] ❌ Erro na conversão:", error);
    throw error;
  }
}

// Verifica se FFmpeg está carregado
export function isFFmpegLoaded() {
  return sandboxReady;
}

// Termina o FFmpeg
export async function terminateFFmpeg() {
  if (sandboxFrame && sandboxReady) {
    try {
      await sendToSandbox("TERMINATE");
    } catch (e) {
      // Ignora erros
    }
    sandboxFrame.remove();
    sandboxFrame = null;
    sandboxReady = false;
    console.log("[FFmpeg] Terminado");
  }
}
