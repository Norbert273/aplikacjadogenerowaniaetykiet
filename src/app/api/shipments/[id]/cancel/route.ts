import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelInPostShipment } from "@/lib/carriers/inpost";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nie zalogowano" }, { status: 401 });
  }

  const { id } = await params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
  });

  if (!shipment) {
    return Response.json({ error: "Przesyłka nie znaleziona" }, { status: 404 });
  }

  // Only owner or admin can cancel
  if (shipment.userId !== session.user.id && session.user.role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  try {
    if (shipment.carrier === "INPOST" && shipment.trackingNumber) {
      // Try to cancel in InPost API using the tracking number as shipment ID
      // InPost uses numeric IDs, tracking number might differ
      await cancelInPostShipment(shipment.trackingNumber);
    }

    await prisma.shipment.update({
      where: { id },
      data: {
        status: "ERROR",
        errorMessage: "Anulowano przez użytkownika",
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Błąd anulowania" },
      { status: 500 }
    );
  }
}
