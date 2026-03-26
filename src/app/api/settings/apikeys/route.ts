import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = [
  "INPOST_API_TOKEN",
  "INPOST_ORGANIZATION_ID",
  "INPOST_API_URL",
  "DHL_API_LOGIN",
  "DHL_API_PASSWORD",
  "DHL_SAP_NUMBER",
  "DHL_API_URL",
];

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const settings = await prisma.appSettings.findMany({
    where: { key: { in: ALLOWED_KEYS } },
  });

  // Mask sensitive values
  const masked = settings.map((s) => ({
    key: s.key,
    value: s.value ? `${s.value.slice(0, 4)}${"*".repeat(Math.max(0, s.value.length - 4))}` : "",
    hasValue: !!s.value,
  }));

  return Response.json(masked);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const body = await request.json();
  const { settings } = body as { settings: { key: string; value: string }[] };

  if (!settings || !Array.isArray(settings)) {
    return Response.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }

  for (const { key, value } of settings) {
    if (!ALLOWED_KEYS.includes(key)) continue;

    await prisma.appSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  return Response.json({ success: true });
}
