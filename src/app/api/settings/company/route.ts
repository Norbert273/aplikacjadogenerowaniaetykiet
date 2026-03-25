import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nie zalogowano" }, { status: 401 });
  }

  const address = await prisma.companyAddress.findFirst({
    where: { isActive: true },
  });

  return Response.json(address);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const body = await request.json();
  const { name, street, city, postalCode, country, phone, email, contactPerson } = body;

  if (!name || !street || !city || !postalCode) {
    return Response.json(
      { error: "Nazwa, ulica, miasto i kod pocztowy są wymagane" },
      { status: 400 }
    );
  }

  // Deactivate existing
  await prisma.companyAddress.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const address = await prisma.companyAddress.create({
    data: {
      name,
      street,
      city,
      postalCode,
      country: country || "PL",
      phone: phone || null,
      email: email || null,
      contactPerson: contactPerson || null,
      isActive: true,
    },
  });

  return Response.json(address);
}
