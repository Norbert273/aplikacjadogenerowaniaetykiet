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

  if (shipment.userId !== session.user.id && session.user.role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  if (shipment.status === "ERROR" && shipment.errorMessage === "Anulowano przez użytkownika") {
    return Response.json({ error: "Przesyłka już anulowana" }, { status: 400 });
  }

  try {
    // Cancel in carrier API
    if (shipment.carrier === "INPOST" && shipment.labelUrl) {
      // labelUrl stores the InPost numeric shipment ID
      await cancelInPostShipment(shipment.labelUrl);
    }

    await prisma.shipment.update({
      where: { id },
      data: {
        status: "ERROR",
        errorMessage: "Anulowano przez użytkownika",
      },
    });

    return Response.json({ success: true, message: "Przesyłka anulowana" });
  } catch (error) {
    // Even if API cancel fails, mark as cancelled locally
    const errorMsg = error instanceof Error ? error.message : "Błąd anulowania";

    await prisma.shipment.update({
      where: { id },
      data: {
        status: "ERROR",
        errorMessage: `Anulowano (błąd API: ${errorMsg})`,
      },
    });

    return Response.json({
      success: true,
      message: "Przesyłka anulowana lokalnie, ale wystąpił błąd API: " + errorMsg,
    });
  }
}
