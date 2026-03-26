import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const { name, street, city, postalCode, country, phone, email, defaultCarrier, whatsappGroupId, whatsappGroupName } = body;

  const template = await prisma.senderTemplate.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(street && { street }),
      ...(city && { city }),
      ...(postalCode && { postalCode }),
      ...(country && { country }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(email !== undefined && { email: email || null }),
      ...(defaultCarrier !== undefined && { defaultCarrier: defaultCarrier || null }),
      ...(whatsappGroupId !== undefined && { whatsappGroupId: whatsappGroupId || null }),
      ...(whatsappGroupName !== undefined && { whatsappGroupName: whatsappGroupName || null }),
    },
  });

  return Response.json(template);
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

  await prisma.senderTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  return Response.json({ success: true });
}
