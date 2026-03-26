import { auth } from "@/lib/auth";
import { getWhatsAppGroups, getWhatsAppStatus } from "@/lib/whatsapp-client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nie zalogowano" }, { status: 401 });
  }

  const status = getWhatsAppStatus();
  if (!status.isReady) {
    return Response.json(
      { error: "WhatsApp nie jest połączony. Połącz w ustawieniach." },
      { status: 503 }
    );
  }

  try {
    const groups = await getWhatsAppGroups();
    return Response.json(groups);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Błąd pobierania grup WhatsApp",
      },
      { status: 500 }
    );
  }
}
