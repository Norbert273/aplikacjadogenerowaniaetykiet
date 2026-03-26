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
    return Response.json(
      { error: "Przesyłka nie znaleziona" },
      { status: 404 }
    );
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

  // Check if the sender template has a WhatsApp group assigned
  let whatsappGroupId: string | null = null;
  let whatsappGroupName: string | null = null;

  // Find the sender template by matching sender name
  const senderTemplate = await prisma.senderTemplate.findFirst({
    where: {
      name: shipment.senderName,
      isActive: true,
    },
  });

  if (senderTemplate) {
    whatsappGroupId = senderTemplate.whatsappGroupId;
    whatsappGroupName = senderTemplate.whatsappGroupName;
  }

  const recipientPhone = phone || shipment.senderPhone || shipment.user.phone;

  if (!whatsappGroupId && !recipientPhone) {
    return Response.json(
      {
        error:
          "Brak grupy WhatsApp i numeru telefonu. Przypisz grupę do szablonu nadawcy lub podaj numer.",
      },
      { status: 400 }
    );
  }

  try {
    await sendLabelViaWhatsApp(
      Buffer.from(shipment.labelData),
      recipientPhone || "",
      shipment.trackingNumber || "",
      shipment.carrier,
      whatsappGroupId,
      whatsappGroupName
    );

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        whatsappSent: true,
        whatsappSentAt: new Date(),
        status: "SENT_WHATSAPP",
      },
    });

    return Response.json({
      success: true,
      sentTo: whatsappGroupId
        ? `Grupa: ${whatsappGroupName || whatsappGroupId}`
        : recipientPhone,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Błąd wysyłki WhatsApp",
      },
      { status: 500 }
    );
  }
}
