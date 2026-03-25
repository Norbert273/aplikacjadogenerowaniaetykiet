import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDHLShipment, getDHLLabel } from "@/lib/carriers/dhl";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nie zalogowano" }, { status: 401 });
  }

  const body = await request.json();
  const { senderName, senderStreet, senderCity, senderPostalCode, senderPhone, senderEmail, weight } = body;

  if (!senderName || !senderStreet || !senderCity || !senderPostalCode) {
    return Response.json(
      { error: "Uzupełnij dane nadawcy" },
      { status: 400 }
    );
  }

  const companyAddress = await prisma.companyAddress.findFirst({
    where: { isActive: true },
  });

  if (!companyAddress) {
    return Response.json(
      { error: "Brak skonfigurowanego adresu firmy. Skontaktuj się z administratorem." },
      { status: 400 }
    );
  }

  const shipment = await prisma.shipment.create({
    data: {
      userId: session.user.id,
      carrier: "DHL",
      status: "PENDING",
      senderName,
      senderStreet,
      senderCity,
      senderPostalCode,
      senderPhone: senderPhone || null,
      senderEmail: senderEmail || null,
      recipientName: companyAddress.name,
      recipientStreet: companyAddress.street,
      recipientCity: companyAddress.city,
      recipientPostalCode: companyAddress.postalCode,
      recipientPhone: companyAddress.phone,
      recipientEmail: companyAddress.email,
      weight: weight ? parseFloat(weight) : 1,
    },
  });

  try {
    const result = await createDHLShipment({
      senderName,
      senderStreet,
      senderCity,
      senderPostalCode,
      senderPhone: senderPhone || "",
      senderEmail: senderEmail || "",
      recipientName: companyAddress.name,
      recipientStreet: companyAddress.street,
      recipientCity: companyAddress.city,
      recipientPostalCode: companyAddress.postalCode,
      recipientPhone: companyAddress.phone || "",
      recipientEmail: companyAddress.email || "",
      weight: weight ? parseFloat(weight) : 1,
    });

    // Get label PDF separately
    const labelData = await getDHLLabel(result.shipmentId);

    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        trackingNumber: result.trackingNumber,
        labelData: new Uint8Array(labelData),
        labelUrl: result.shipmentId, // Store DHL shipment ID for cancel
        status: "LABEL_GENERATED",
      },
    });

    return Response.json({
      id: updated.id,
      trackingNumber: updated.trackingNumber,
      status: updated.status,
    });
  } catch (error) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Nieznany błąd",
      },
    });

    return Response.json(
      { error: error instanceof Error ? error.message : "Błąd DHL API" },
      { status: 500 }
    );
  }
}
