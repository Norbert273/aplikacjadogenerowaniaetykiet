import { auth } from "@/lib/auth";
import {
  initWhatsApp,
  getWhatsAppStatus,
  destroyWhatsApp,
} from "@/lib/whatsapp-client";
import QRCode from "qrcode";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const status = getWhatsAppStatus();

  // Auto-init if not started
  if (!status.isReady && !status.isInitializing && !status.qrCode) {
    try {
      initWhatsApp().catch((err) =>
        console.error("[WhatsApp] Background init error:", err)
      );
      // Return initializing status immediately
      return Response.json({
        isReady: false,
        hasQR: false,
        qrDataUrl: null,
        isInitializing: true,
      });
    } catch {
      return Response.json({
        isReady: false,
        hasQR: false,
        qrDataUrl: null,
        isInitializing: false,
        error: "Błąd inicjalizacji WhatsApp",
      });
    }
  }

  let qrDataUrl: string | null = null;
  if (status.qrCode) {
    try {
      qrDataUrl = await QRCode.toDataURL(status.qrCode, { width: 300 });
    } catch {
      qrDataUrl = null;
    }
  }

  return Response.json({
    isReady: status.isReady,
    hasQR: !!status.qrCode,
    qrDataUrl,
    isInitializing: status.isInitializing,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "reconnect") {
    await destroyWhatsApp();
    initWhatsApp().catch((err) =>
      console.error("[WhatsApp] Reconnect error:", err)
    );
    return Response.json({ success: true, message: "Ponowne łączenie..." });
  }

  if (action === "disconnect") {
    await destroyWhatsApp();
    return Response.json({ success: true, message: "Rozłączono" });
  }

  return Response.json({ error: "Nieznana akcja" }, { status: 400 });
}
