import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInPostShipmentStatus } from "@/lib/carriers/inpost";
import { getDHLTrackingStatus } from "@/lib/carriers/dhl";

export async function POST(
  _request: Request,
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

  if (shipment.userId !== session.user.id && (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  let carrierStatus = "unknown";
  let carrierStatusPl = "Nieznany";

  try {
    if (shipment.carrier === "INPOST" && shipment.labelUrl) {
      const result = await getInPostShipmentStatus(shipment.labelUrl);
      carrierStatus = result.status;
      carrierStatusPl = result.statusPl;
    } else if (shipment.carrier === "DHL" && shipment.labelUrl) {
      const result = await getDHLTrackingStatus(shipment.labelUrl);
      carrierStatus = result.status;
      carrierStatusPl = result.statusPl;
    }

    await prisma.shipment.update({
      where: { id },
      data: {
        carrierStatus,
        carrierStatusPl,
        carrierStatusAt: new Date(),
      },
    });

    return Response.json({
      carrierStatus,
      carrierStatusPl,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Błąd sprawdzania statusu" },
      { status: 500 }
    );
  }
}
