import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import * as fs from "fs";
import * as path from "path";

// Global singleton state
let client: Client | null = null;
let qrCode: string | null = null;
let isReady = false;
let isInitializing = false;
let lastError: string | null = null;

function getAuthPath(): string {
  // Use /app/.wwebjs_auth in production, local path in dev
  const prodPath = "/app/.wwebjs_auth";
  if (fs.existsSync("/app")) {
    return prodPath;
  }
  const devPath = path.join(process.cwd(), ".wwebjs_auth");
  if (!fs.existsSync(devPath)) {
    try {
      fs.mkdirSync(devPath, { recursive: true });
    } catch {
      // ignore
    }
  }
  return devPath;
}

function createClient(): Client {
  const authPath = getAuthPath();

  // Ensure XDG dirs point to writable location (fixes crashpad in Docker)
  if (!process.env.XDG_CONFIG_HOME) {
    process.env.XDG_CONFIG_HOME = "/tmp/.chromium";
  }
  if (!process.env.XDG_CACHE_HOME) {
    process.env.XDG_CACHE_HOME = "/tmp/.chromium";
  }

  // Use Puppeteer's bundled Chrome (don't set executablePath)
  // Puppeteer downloads a compatible Chrome version during npm install
  const puppeteerOptions: Record<string, unknown> = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ],
  };

  console.log("[WhatsApp] Auth data path:", authPath);
  console.log("[WhatsApp] Using Puppeteer bundled Chrome");

  return new Client({
    authStrategy: new LocalAuth({ dataPath: authPath }),
    puppeteer: puppeteerOptions,
  });
}

export async function initWhatsApp(): Promise<void> {
  if (isInitializing || isReady) return;
  if (client) return;

  isInitializing = true;
  qrCode = null;
  lastError = null;

  try {
    client = createClient();

    client.on("qr", (qr: string) => {
      console.log("[WhatsApp] QR code received");
      qrCode = qr;
      isReady = false;
      isInitializing = false;
      lastError = null;
    });

    client.on("ready", () => {
      console.log("[WhatsApp] Client is ready!");
      isReady = true;
      qrCode = null;
      isInitializing = false;
      lastError = null;
    });

    client.on("loading_screen", (percent: number, message: string) => {
      console.log(`[WhatsApp] Loading: ${percent}% - ${message}`);
    });

    client.on("authenticated", () => {
      console.log("[WhatsApp] Authenticated");
    });

    client.on("auth_failure", (msg: string) => {
      console.error("[WhatsApp] Auth failure:", msg);
      isReady = false;
      isInitializing = false;
      qrCode = null;
      lastError = `Błąd autoryzacji: ${msg}`;
      client = null;
    });

    client.on("disconnected", (reason: string) => {
      console.log("[WhatsApp] Disconnected:", reason);
      isReady = false;
      qrCode = null;
      client = null;
      isInitializing = false;
      lastError = `Rozłączono: ${reason}`;
    });

    await client.initialize();
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    console.error("[WhatsApp] Init error:", errorMsg);
    isReady = false;
    isInitializing = false;
    qrCode = null;
    client = null;
    lastError = `Błąd uruchamiania: ${errorMsg}`;
    throw error;
  }
}

export function getWhatsAppStatus(): {
  isReady: boolean;
  qrCode: string | null;
  isInitializing: boolean;
  lastError: string | null;
} {
  return { isReady, qrCode, isInitializing, lastError };
}

export async function getWhatsAppGroups(): Promise<
  { id: string; name: string; participantCount: number }[]
> {
  if (!client || !isReady) {
    throw new Error("WhatsApp nie jest połączony");
  }

  const chats = await client.getChats();
  const groups = chats.filter((chat) => chat.isGroup);

  return groups.map((g) => ({
    id: g.id._serialized,
    name: g.name,
    participantCount:
      (g as unknown as { participants?: unknown[] }).participants?.length ?? 0,
  }));
}

export async function sendToGroup(
  groupId: string,
  pdfBuffer: Buffer,
  filename: string,
  caption: string
): Promise<void> {
  if (!client || !isReady) {
    throw new Error("WhatsApp nie jest połączony");
  }

  const base64 = pdfBuffer.toString("base64");
  const media = new MessageMedia("application/pdf", base64, filename);

  await client.sendMessage(groupId, media, { caption });
}

export async function sendToNumber(
  phone: string,
  pdfBuffer: Buffer,
  filename: string,
  caption: string
): Promise<void> {
  if (!client || !isReady) {
    throw new Error("WhatsApp nie jest połączony");
  }

  // Normalize phone: ensure format like 48XXXXXXXXX@c.us
  let normalized = phone.replace(/[^0-9]/g, "");
  if (normalized.startsWith("0")) {
    normalized = "48" + normalized.slice(1);
  } else if (!normalized.startsWith("48") && normalized.length <= 9) {
    normalized = "48" + normalized;
  }
  const chatId = normalized + "@c.us";

  const base64 = pdfBuffer.toString("base64");
  const media = new MessageMedia("application/pdf", base64, filename);

  await client.sendMessage(chatId, media, { caption });
}

export async function destroyWhatsApp(clearSession = false): Promise<void> {
  if (client) {
    try {
      await client.destroy();
    } catch {
      // ignore
    }
    client = null;
    isReady = false;
    qrCode = null;
    isInitializing = false;
    lastError = null;
  }

  if (clearSession) {
    // Clear cached session data to force fresh QR authentication
    const authPath = getAuthPath();
    try {
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        fs.mkdirSync(authPath, { recursive: true });
        console.log("[WhatsApp] Session data cleared:", authPath);
      }
    } catch (err) {
      console.error("[WhatsApp] Failed to clear session:", err);
    }
  }
}
