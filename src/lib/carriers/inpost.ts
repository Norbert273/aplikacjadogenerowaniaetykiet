import { prisma } from "../prisma";

interface InPostShipmentData {
  senderName: string;
  senderStreet: string;
  senderCity: string;
  senderPostalCode: string;
  senderPhone: string;
  senderEmail: string;
  recipientName: string;
  recipientStreet: string;
  recipientCity: string;
  recipientPostalCode: string;
  recipientPhone: string;
  recipientEmail: string;
  parcelSize: string; // "A", "B", "C"
}

async function getInPostConfig() {
  const [tokenSetting, orgSetting, urlSetting] = await Promise.all([
    prisma.appSettings.findUnique({ where: { key: "INPOST_API_TOKEN" } }),
    prisma.appSettings.findUnique({ where: { key: "INPOST_ORGANIZATION_ID" } }),
    prisma.appSettings.findUnique({ where: { key: "INPOST_API_URL" } }),
  ]);

  const token = tokenSetting?.value || process.env.INPOST_API_TOKEN;
  const organizationId =
    orgSetting?.value || process.env.INPOST_ORGANIZATION_ID;
  const apiUrl =
    urlSetting?.value ||
    process.env.INPOST_API_URL ||
    "https://api-shipx-pl.easypack24.net/v1";

  if (!token || !organizationId) {
    throw new Error(
      "Brak konfiguracji InPost API. Uzupełnij token i ID organizacji w ustawieniach."
    );
  }

  return { token, organizationId, apiUrl };
}

export async function createInPostShipment(data: InPostShipmentData) {
  const config = await getInPostConfig();

  const shipmentPayload = {
    receiver: {
      name: data.recipientName,
      phone: data.recipientPhone,
      email: data.recipientEmail,
      address: {
        street: data.recipientStreet,
        city: data.recipientCity,
        post_code: data.recipientPostalCode,
        country_code: "PL",
      },
    },
    sender: {
      name: data.senderName,
      phone: data.senderPhone,
      email: data.senderEmail,
      address: {
        street: data.senderStreet,
        city: data.senderCity,
        post_code: data.senderPostalCode,
        country_code: "PL",
      },
    },
    parcels: [
      {
        dimensions: getParcelDimensions(data.parcelSize),
        weight: {
          amount: 1,
          unit: "kg",
        },
        is_non_standard: false,
      },
    ],
    service: "inpost_locker_standard",
    reference: `LABEL-${Date.now()}`,
    comments: "Wygenerowano przez Generator Etykiet",
  };

  const response = await fetch(
    `${config.apiUrl}/organizations/${config.organizationId}/shipments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(shipmentPayload),
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`InPost API error: ${response.status} - ${errorData}`);
  }

  const result = await response.json();
  return {
    shipmentId: result.id,
    trackingNumber: result.tracking_number,
    status: result.status,
  };
}

export async function getInPostLabel(shipmentId: string): Promise<Buffer> {
  const config = await getInPostConfig();

  const response = await fetch(
    `${config.apiUrl}/shipments/${shipmentId}/label`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/pdf",
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(
      `InPost Label API error: ${response.status} - ${errorData}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function getParcelDimensions(size: string) {
  switch (size) {
    case "A":
      return { length: 380, width: 640, height: 80, unit: "mm" };
    case "B":
      return { length: 380, width: 640, height: 190, unit: "mm" };
    case "C":
      return { length: 410, width: 380, height: 640, unit: "mm" };
    default:
      return { length: 380, width: 640, height: 80, unit: "mm" };
  }
}
