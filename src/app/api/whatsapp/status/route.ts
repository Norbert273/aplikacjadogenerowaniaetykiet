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
    error: status.lastError,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "connect" || action === "reconnect") {
    if (action === "reconnect") {
      await destroyWhatsApp();
    }
    try {
      // Don't await - let it initialize in background
      initWhatsApp().catch((err) =>
        console.error("[WhatsApp] Init error:", err)
      );
      return Response.json({
        success: true,
        message: "Uruchamianie WhatsApp...",
      });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Błąd uruchamiania WhatsApp",
        },
        { status: 500 }
      );
    }
  }

  if (action === "disconnect") {
    await destroyWhatsApp();
    return Response.json({ success: true, message: "Rozłączono" });
  }

  return Response.json({ error: "Nieznana akcja" }, { status: 400 });
}
