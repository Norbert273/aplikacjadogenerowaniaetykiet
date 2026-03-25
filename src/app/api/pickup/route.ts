import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestInPostPickup } from "@/lib/carriers/inpost";
import { requestDHLPickup } from "@/lib/carriers/dhl";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nie zalogowano" }, { status: 401 });
  }

  const body = await request.json();
  const { shipmentId, pickupDate, pickupTimeFrom, pickupTimeTo } = body;

  if (!shipmentId || !pickupDate || !pickupTimeFrom || !pickupTimeTo) {
    return Response.json(
      { error: "Podaj ID przesyłki, datę i godziny odbioru" },
      { status: 400 }
    );
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
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

  if (shipment.status === "PENDING" || shipment.status === "ERROR") {
    return Response.json(
      { error: "Etykieta musi być najpierw wygenerowana" },
      { status: 400 }
    );
  }

  const pickup = await prisma.pickupRequest.create({
    data: {
      shipmentId,
      carrier: shipment.carrier,
      pickupDate,
      pickupTimeFrom,
      pickupTimeTo,
      status: "REQUESTED",
    },
  });

  try {
    let confirmationNumber: string;

    if (shipment.carrier === "INPOST") {
      confirmationNumber = await requestInPostPickup({
        shipmentId: shipment.trackingNumber || shipment.id,
        senderName: shipment.senderName,
        senderStreet: shipment.senderStreet,
        senderCity: shipment.senderCity,
        senderPostalCode: shipment.senderPostalCode,
        senderPhone: shipment.senderPhone || "",
        senderEmail: shipment.senderEmail || "",
        pickupDate,
        pickupTimeFrom,
        pickupTimeTo,
      });
    } else {
      confirmationNumber = await requestDHLPickup({
        senderName: shipment.senderName,
        senderStreet: shipment.senderStreet,
        senderCity: shipment.senderCity,
        senderPostalCode: shipment.senderPostalCode,
        senderPhone: shipment.senderPhone || "",
        senderEmail: shipment.senderEmail || "",
        pickupDate,
        pickupTimeFrom,
        pickupTimeTo,
      });
    }

    await prisma.pickupRequest.update({
      where: { id: pickup.id },
      data: {
        status: "CONFIRMED",
        confirmationNumber,
      },
    });

    return Response.json({
      success: true,
      confirmationNumber,
    });
  } catch (error) {
    await prisma.pickupRequest.update({
      where: { id: pickup.id },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Nieznany błąd",
      },
    });

    return Response.json(
      { error: error instanceof Error ? error.message : "Błąd zamawiania kuriera" },
      { status: 500 }
    );
  }
}
