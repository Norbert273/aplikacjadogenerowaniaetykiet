import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nie zalogowano" }, { status: 401 });
  }

  const templates = await prisma.senderTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return Response.json(templates);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const body = await request.json();
  const { name, street, city, postalCode, country, phone, email } = body;

  if (!name || !street || !city || !postalCode) {
    return Response.json(
      { error: "Nazwa, ulica, miasto i kod pocztowy są wymagane" },
      { status: 400 }
    );
  }

  const template = await prisma.senderTemplate.create({
    data: {
      name,
      street,
      city,
      postalCode,
      country: country || "PL",
      phone: phone || null,
      email: email || null,
    },
  });

  return Response.json(template, { status: 201 });
}
