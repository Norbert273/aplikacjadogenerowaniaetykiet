import { sendToGroup, sendToNumber } from "./whatsapp-client";

export async function sendLabelViaWhatsApp(
  pdfBuffer: Buffer,
  recipientPhone: string,
  trackingNumber: string,
  carrier: string,
  whatsappGroupId?: string | null,
  whatsappGroupName?: string | null
): Promise<void> {
  const fileName = `etykieta_${carrier}_${trackingNumber || Date.now()}.pdf`;
  const caption = `Etykieta wysyłkowa ${carrier}${trackingNumber ? ` - numer śledzenia: ${trackingNumber}` : ""}`;

  if (whatsappGroupId) {
    await sendToGroup(whatsappGroupId, pdfBuffer, fileName, caption);
  } else if (recipientPhone) {
    await sendToNumber(recipientPhone, pdfBuffer, fileName, caption);
  } else {
    throw new Error(
      "Brak grupy WhatsApp i numeru telefonu. Podaj przynajmniej jedno."
    );
  }
}
