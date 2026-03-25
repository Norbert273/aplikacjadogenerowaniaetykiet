import { prisma } from "./prisma";

async function getWhatsAppConfig() {
  const [tokenSetting, phoneIdSetting] = await Promise.all([
    prisma.appSettings.findUnique({ where: { key: "WHATSAPP_TOKEN" } }),
    prisma.appSettings.findUnique({
      where: { key: "WHATSAPP_PHONE_NUMBER_ID" },
    }),
  ]);

  const token = tokenSetting?.value || process.env.WHATSAPP_TOKEN;
  const phoneNumberId =
    phoneIdSetting?.value || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error(
      "Brak konfiguracji WhatsApp API. Uzupełnij token i Phone Number ID w ustawieniach."
    );
  }

  return { token, phoneNumberId };
}

export async function uploadMediaToWhatsApp(
  pdfBuffer: Buffer,
  fileName: string
): Promise<string> {
  const config = await getWhatsAppConfig();

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  formData.append("file", blob, fileName);
  formData.append("messaging_product", "whatsapp");
  formData.append("type", "application/pdf");

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${config.phoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(
      `WhatsApp Media Upload error: ${response.status} - ${errorData}`
    );
  }

  const result = await response.json();
  return result.id;
}

export async function sendWhatsAppDocument(
  recipientPhone: string,
  mediaId: string,
  caption: string
): Promise<void> {
  const config = await getWhatsAppConfig();

  // Normalize phone number - ensure it starts with country code
  const phone = recipientPhone.startsWith("+")
    ? recipientPhone.slice(1)
    : recipientPhone.startsWith("48")
      ? recipientPhone
      : `48${recipientPhone}`;

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "document",
        document: {
          id: mediaId,
          caption: caption,
          filename: "etykieta.pdf",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`WhatsApp Send error: ${response.status} - ${errorData}`);
  }
}

export async function sendLabelViaWhatsApp(
  pdfBuffer: Buffer,
  recipientPhone: string,
  trackingNumber: string,
  carrier: string
): Promise<void> {
  const fileName = `etykieta_${carrier}_${trackingNumber || Date.now()}.pdf`;
  const caption = `Etykieta wysyłkowa ${carrier}${trackingNumber ? ` - numer śledzenia: ${trackingNumber}` : ""}`;

  const mediaId = await uploadMediaToWhatsApp(pdfBuffer, fileName);
  await sendWhatsAppDocument(recipientPhone, mediaId, caption);
}
