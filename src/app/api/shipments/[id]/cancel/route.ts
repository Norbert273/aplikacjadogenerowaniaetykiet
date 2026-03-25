import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelInPostShipment, getInPostShipmentStatus } from "@/lib/carriers/inpost";
import { deleteDHLShipment } from "@/lib/carriers/dhl";

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

  if (shipment.userId !== session.user.id && session.user.role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  if (shipment.status === "ERROR" && shipment.errorMessage?.startsWith("Anulowano")) {
    return Response.json({ error: "Przesyłka już anulowana" }, { status: 400 });
  }

  try {
    let cancelMessage = "Anulowano przez użytkownika";
    let inpostStatus = "";

    if (shipment.carrier === "INPOST" && shipment.labelUrl) {
      const result = await cancelInPostShipment(shipment.labelUrl);
      inpostStatus = result.status;
      cancelMessage = result.message;

      if (!result.success) {
        return Response.json({
          success: false,
          error: result.message,
          inpostStatus: result.status,
        }, { status: 400 });
      }
    } else if (shipment.carrier === "DHL" && shipment.labelUrl) {
      await deleteDHLShipment(shipment.labelUrl);
      cancelMessage = "Przesyłka DHL anulowana.";
    }

    await prisma.shipment.update({
      where: { id },
      data: {
        status: "ERROR",
        errorMessage: cancelMessage,
      },
    });

    return Response.json({
      success: true,
      message: cancelMessage,
      inpostStatus,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Błąd anulowania" },
      { status: 500 }
    );
  }
}

// GET - check current InPost status of a shipment
export async function GET(
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

  if (shipment.carrier === "INPOST" && shipment.labelUrl) {
    const { status, statusPl } = await getInPostShipmentStatus(shipment.labelUrl);
    return Response.json({
      inpostStatus: status,
      inpostStatusPl: statusPl,
      localStatus: shipment.status,
    });
  }

  return Response.json({
    inpostStatus: null,
    localStatus: shipment.status,
  });
}
