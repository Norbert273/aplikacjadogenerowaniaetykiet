import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nie zalogowano" }, { status: 401 });
  }

  const isAdmin = (session.user as { role: string }).role === "ADMIN";

  const shipments = await prisma.shipment.findMany({
    where: isAdmin ? {} : { userId: session.user.id },
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Return shipments without labelData (too large for list)
  const result = shipments.map((s) => ({
    ...s,
    labelData: undefined,
    hasLabel: !!s.labelData,
  }));

  return Response.json(result);
}
