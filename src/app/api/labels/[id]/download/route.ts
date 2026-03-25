import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
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

  // Only allow own shipments or admin
  if (
    shipment.userId !== session.user.id &&
    (session.user as { role: string }).role !== "ADMIN"
  ) {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  if (!shipment.labelData) {
    return Response.json(
      { error: "Etykieta nie została jeszcze wygenerowana" },
      { status: 404 }
    );
  }

  const fileName = `etykieta_${shipment.carrier}_${shipment.trackingNumber || shipment.id}.pdf`;

  return new Response(shipment.labelData, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
