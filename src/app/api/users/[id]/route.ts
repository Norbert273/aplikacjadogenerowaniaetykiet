import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { email, name, password, phone, street, city, postalCode, country, companyName } = body;

  const updateData: Record<string, unknown> = {};
  if (email) updateData.email = email;
  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone || null;
  if (street !== undefined) updateData.street = street || null;
  if (city !== undefined) updateData.city = city || null;
  if (postalCode !== undefined) updateData.postalCode = postalCode || null;
  if (country !== undefined) updateData.country = country;
  if (companyName !== undefined) updateData.companyName = companyName || null;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
    },
  });

  return Response.json(user);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const { id } = await params;

  // Don't allow deleting yourself
  if (id === session.user.id) {
    return Response.json(
      { error: "Nie możesz usunąć własnego konta" },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return Response.json({ success: true });
}
