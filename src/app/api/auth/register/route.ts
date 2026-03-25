import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const body = await request.json();
  const { email, name, password, phone, street, city, postalCode, country, companyName } = body;

  if (!email || !name || !password) {
    return Response.json(
      { error: "Email, imię i hasło są wymagane" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json(
      { error: "Użytkownik z tym emailem już istnieje" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      phone: phone || null,
      street: street || null,
      city: city || null,
      postalCode: postalCode || null,
      country: country || "PL",
      companyName: companyName || null,
      role: "USER",
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  return Response.json(user, { status: 201 });
}
