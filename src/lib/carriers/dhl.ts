import { prisma } from "../prisma";

interface DHLShipmentData {
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
  weight: number;
}

async function getDHLConfig() {
  const [keySetting, secretSetting, urlSetting, accountSetting] =
    await Promise.all([
      prisma.appSettings.findUnique({ where: { key: "DHL_API_KEY" } }),
      prisma.appSettings.findUnique({ where: { key: "DHL_API_SECRET" } }),
      prisma.appSettings.findUnique({ where: { key: "DHL_API_URL" } }),
      prisma.appSettings.findUnique({ where: { key: "DHL_ACCOUNT_NUMBER" } }),
    ]);

  const apiKey = keySetting?.value || process.env.DHL_API_KEY;
  const apiSecret = secretSetting?.value || process.env.DHL_API_SECRET;
  const apiUrl =
    urlSetting?.value ||
    process.env.DHL_API_URL ||
    "https://express.api.dhl.com/mydhlapi";
  const accountNumber =
    accountSetting?.value || process.env.DHL_ACCOUNT_NUMBER;

  if (!apiKey || !apiSecret || !accountNumber) {
    throw new Error(
      "Brak konfiguracji DHL API. Uzupełnij klucz API, secret i numer konta w ustawieniach."
    );
  }

  return { apiKey, apiSecret, apiUrl, accountNumber };
}

export async function createDHLShipment(
  data: DHLShipmentData
): Promise<{ trackingNumber: string; labelData: Buffer }> {
  const config = await getDHLConfig();

  const today = new Date();
  const shipTimestamp = today.toISOString();

  const shipmentPayload = {
    plannedShippingDateAndTime: shipTimestamp,
    pickup: { isRequested: false },
    productCode: "N",
    accounts: [
      {
        typeCode: "shipper",
        number: config.accountNumber,
      },
    ],
    customerDetails: {
      shipperDetails: {
        postalAddress: {
          postalCode: data.senderPostalCode,
          cityName: data.senderCity,
          countryCode: "PL",
          addressLine1: data.senderStreet,
        },
        contactInformation: {
          email: data.senderEmail,
          phone: data.senderPhone,
          companyName: data.senderName,
          fullName: data.senderName,
        },
      },
      receiverDetails: {
        postalAddress: {
          postalCode: data.recipientPostalCode,
          cityName: data.recipientCity,
          countryCode: "PL",
          addressLine1: data.recipientStreet,
        },
        contactInformation: {
          email: data.recipientEmail,
          phone: data.recipientPhone,
          companyName: data.recipientName,
          fullName: data.recipientName,
        },
      },
    },
    content: {
      packages: [
        {
          weight: data.weight,
          dimensions: {
            length: 30,
            width: 20,
            height: 15,
          },
        },
      ],
      isCustomsDeclarable: false,
      declaredValue: 0,
      declaredValueCurrency: "PLN",
      unitOfMeasurement: "metric",
      description: "Przesylka",
    },
    outputImageProperties: {
      imageOptions: [
        {
          typeCode: "label",
          templateName: "ECOM26_84_001",
        },
      ],
      splitTransportAndWaybillDocLabels: false,
      allDocumentsInOneImage: false,
      encodingFormat: "pdf",
    },
  };

  const authString = Buffer.from(
    `${config.apiKey}:${config.apiSecret}`
  ).toString("base64");

  const response = await fetch(`${config.apiUrl}/shipments`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(shipmentPayload),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`DHL API error: ${response.status} - ${errorData}`);
  }

  const result = await response.json();

  const trackingNumber =
    result.shipmentTrackingNumber ||
    result.packages?.[0]?.trackingNumber ||
    "";

  let labelData: Buffer;
  if (result.documents?.[0]?.content) {
    labelData = Buffer.from(result.documents[0].content, "base64");
  } else {
    labelData = Buffer.alloc(0);
  }

  return { trackingNumber, labelData };
}
