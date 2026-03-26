import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";

// Global singleton state
let client: Client | null = null;
let qrCode: string | null = null;
let isReady = false;
let isInitializing = false;

function createClient(): Client {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: "/app/.wwebjs_auth" }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    },
  });
}

export async function initWhatsApp(): Promise<void> {
  if (isInitializing || isReady) return;
  if (client) return;

  isInitializing = true;
  qrCode = null;

  try {
    client = createClient();

    client.on("qr", (qr: string) => {
      console.log("[WhatsApp] QR code received");
      qrCode = qr;
      isReady = false;
    });

    client.on("ready", () => {
      console.log("[WhatsApp] Client is ready");
      isReady = true;
      qrCode = null;
      isInitializing = false;
    });

    client.on("authenticated", () => {
      console.log("[WhatsApp] Authenticated");
    });

    client.on("auth_failure", (msg: string) => {
      console.error("[WhatsApp] Auth failure:", msg);
      isReady = false;
      isInitializing = false;
      qrCode = null;
      client = null;
    });

    client.on("disconnected", (reason: string) => {
      console.log("[WhatsApp] Disconnected:", reason);
      isReady = false;
      qrCode = null;
      client = null;
      isInitializing = false;
    });

    await client.initialize();
  } catch (error) {
    console.error("[WhatsApp] Init error:", error);
    isReady = false;
    isInitializing = false;
    qrCode = null;
    client = null;
    throw error;
  }
}

export function getWhatsAppStatus(): {
  isReady: boolean;
  qrCode: string | null;
  isInitializing: boolean;
} {
  return { isReady, qrCode, isInitializing };
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
    participantCount: (g as unknown as { participants?: unknown[] })
      .participants?.length ?? 0,
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

export async function destroyWhatsApp(): Promise<void> {
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
  }
}
