import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendLabelViaWhatsApp } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nie zalogowano" }, { status: 401 });
  }

  const body = await request.json();
  const { shipmentId, phone } = body;

  if (!shipmentId) {
    return Response.json(
      { error: "ID przesyłki jest wymagane" },
      { status: 400 }
    );
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { user: true },
  });

  if (!shipment) {
    return Response.json({ error: "Przesyłka nie znaleziona" }, { status: 404 });
  }

  if (
    shipment.userId !== session.user.id &&
    (session.user as { role: string }).role !== "ADMIN"
  ) {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  if (!shipment.labelData) {
    return Response.json(
      { error: "Brak wygenerowanej etykiety" },
      { status: 400 }
    );
  }

  const recipientPhone = phone || shipment.user.phone;
  if (!recipientPhone) {
    return Response.json(
      { error: "Brak numeru telefonu. Podaj numer lub uzupełnij profil użytkownika." },
      { status: 400 }
    );
  }

  try {
    await sendLabelViaWhatsApp(
      Buffer.from(shipment.labelData),
      recipientPhone,
      shipment.trackingNumber || "",
      shipment.carrier
    );

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        whatsappSent: true,
        whatsappSentAt: new Date(),
        status: "SENT_WHATSAPP",
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Błąd wysyłki WhatsApp" },
      { status: 500 }
    );
  }
}
