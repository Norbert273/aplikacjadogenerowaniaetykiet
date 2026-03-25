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

  // Users can only access their own profile, admins can access any
  if (
    id !== session.user.id &&
    (session.user as { role: string }).role !== "ADMIN"
  ) {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
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
    },
  });

  if (!user) {
    return Response.json({ error: "Użytkownik nie znaleziony" }, { status: 404 });
  }

  return Response.json(user);
}
