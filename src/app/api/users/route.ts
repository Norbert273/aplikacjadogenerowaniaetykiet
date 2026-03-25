import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      street: true,
      city: true,
      postalCode: true,
      country: true,
      companyName: true,
      role: true,
      createdAt: true,
      _count: { select: { shipments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(users);
}
