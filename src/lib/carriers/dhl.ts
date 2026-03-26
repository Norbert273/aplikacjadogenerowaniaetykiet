import { prisma } from "../prisma";
import * as soap from "soap";

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

interface DHLConfig {
  username: string;
  password: string;
  sapNumber: string;
  wsdlUrl: string;
}

async function getDHLConfig(): Promise<DHLConfig> {
  const [userSetting, passSetting, sapSetting, urlSetting] = await Promise.all([
    prisma.appSettings.findUnique({ where: { key: "DHL_API_LOGIN" } }),
    prisma.appSettings.findUnique({ where: { key: "DHL_API_PASSWORD" } }),
    prisma.appSettings.findUnique({ where: { key: "DHL_SAP_NUMBER" } }),
    prisma.appSettings.findUnique({ where: { key: "DHL_API_URL" } }),
  ]);

  const username = userSetting?.value || process.env.DHL_API_LOGIN;
  const password = passSetting?.value || process.env.DHL_API_PASSWORD;
  const sapNumber = sapSetting?.value || process.env.DHL_SAP_NUMBER;
  const wsdlUrl =
    urlSetting?.value ||
    process.env.DHL_API_URL ||
    "https://dhl24.com.pl/webapi2";

  if (!username || !password || !sapNumber) {
    throw new Error(
      "Brak konfiguracji DHL API. Uzupełnij Login APIv2, Hasło APIv2 i Numer SAP w ustawieniach."
    );
  }

  return { username, password, sapNumber, wsdlUrl };
}

// Parse street "Kwiatowa 15/3" into street + houseNumber + apartmentNumber
function parseAddress(fullStreet: string): {
  street: string;
  houseNumber: string;
  apartmentNumber: string;
} {
  const trimmed = fullStreet.trim();
  const match = trimmed.match(/^(.+?)\s+(\d+[A-Za-z]?)(?:\/(\d+[A-Za-z]?))?$/);
  if (match) {
    return {
      street: match[1],
      houseNumber: match[2],
      apartmentNumber: match[3] || "",
    };
  }
  return { street: trimmed, houseNumber: "", apartmentNumber: "" };
}

// Remove hyphen from postal code (DHL requires "00001" not "00-001")
function cleanPostalCode(code: string): string {
  return code.replace(/-/g, "");
}

// Create SOAP client from WSDL
let cachedClient: soap.Client | null = null;
let cachedWsdlUrl: string | null = null;

async function getSoapClient(config: DHLConfig): Promise<soap.Client> {
  if (cachedClient && cachedWsdlUrl === config.wsdlUrl) {
    return cachedClient;
  }

  console.log(`DHL: Creating SOAP client from WSDL: ${config.wsdlUrl}`);
  const client = await soap.createClientAsync(config.wsdlUrl);
  cachedClient = client;
  cachedWsdlUrl = config.wsdlUrl;

  // Log available methods for debugging
  const description = client.describe();
  console.log("DHL SOAP service description:", JSON.stringify(Object.keys(description), null, 2));

  return client;
}

function getAuthData(config: DHLConfig) {
  return {
    username: config.username,
    password: config.password,
  };
}

export async function createDHLShipment(
  data: DHLShipmentData
): Promise<{ shipmentId: string; trackingNumber: string }> {
  const config = await getDHLConfig();
  const client = await getSoapClient(config);

  const senderAddr = parseAddress(data.senderStreet);
  const recipientAddr = parseAddress(data.recipientStreet);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const shipmentDate = tomorrow.toISOString().split("T")[0];

  const args = {
    authData: getAuthData(config),
    shipments: {
      item: {
        shipper: {
          name: data.senderName,
          postalCode: cleanPostalCode(data.senderPostalCode),
          city: data.senderCity,
          street: senderAddr.street,
          houseNumber: senderAddr.houseNumber,
          ...(senderAddr.apartmentNumber ? { apartmentNumber: senderAddr.apartmentNumber } : {}),
          contactPerson: data.senderName,
          contactPhone: data.senderPhone,
          contactEmail: data.senderEmail,
        },
        receiver: {
          name: data.recipientName,
          postalCode: cleanPostalCode(data.recipientPostalCode),
          city: data.recipientCity,
          street: recipientAddr.street,
          houseNumber: recipientAddr.houseNumber,
          ...(recipientAddr.apartmentNumber ? { apartmentNumber: recipientAddr.apartmentNumber } : {}),
          contactPerson: data.recipientName,
          contactPhone: data.recipientPhone,
          contactEmail: data.recipientEmail,
          country: "PL",
        },
        pieceList: {
          item: {
            type: "PACKAGE",
            weight: Math.max(1, Math.round(data.weight)),
            width: 30,
            height: 20,
            length: 40,
            quantity: 1,
            nonStandard: false,
          },
        },
        payment: {
          payerType: "SHIPPER",
          accountNumber: config.sapNumber,
          paymentMethod: "BANK_TRANSFER",
        },
        service: {
          product: "AH",
          collectOnDelivery: false,
          insurance: false,
        },
        shipmentDate: shipmentDate,
        content: "Przesylka",
        reference: `LABEL-${Date.now()}`,
        skipRestrictionCheck: true,
      },
    },
  };

  console.log("DHL createShipments args:", JSON.stringify(args, null, 2));

  try {
    const [result] = await client.createShipmentsAsync(args);
    console.log("DHL createShipments result:", JSON.stringify(result, null, 2));

    const item = result?.item || result?.createShipmentsResult?.item;
    const shipmentId = item?.shipmentId || item?.[0]?.shipmentId;

    if (!shipmentId) {
      const errorMsg = item?.error || item?.[0]?.error || JSON.stringify(result);
      throw new Error(`DHL: nie udało się utworzyć przesyłki. ${errorMsg}`);
    }

    return {
      shipmentId: String(shipmentId),
      trackingNumber: String(shipmentId),
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("DHL:")) throw error;
    console.error("DHL createShipments error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`DHL API error: ${msg}`);
  }
}

export async function getDHLLabel(shipmentId: string): Promise<Buffer> {
  const config = await getDHLConfig();
  const client = await getSoapClient(config);

  const args = {
    authData: getAuthData(config),
    itemsToPrint: {
      item: {
        labelType: "BLP",
        shipmentId: shipmentId,
      },
    },
  };

  try {
    const [result] = await client.getLabelsAsync(args);
    console.log("DHL getLabels result keys:", Object.keys(result || {}));

    const item = result?.item || result?.getLabelsResult?.item;
    const labelData = item?.labelData || item?.[0]?.labelData;

    if (!labelData) {
      throw new Error("DHL: nie udało się pobrać etykiety. Brak danych etykiety w odpowiedzi.");
    }

    return Buffer.from(labelData, "base64");
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("DHL:")) throw error;
    console.error("DHL getLabels error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`DHL API error: ${msg}`);
  }
}

export async function deleteDHLShipment(shipmentId: string): Promise<void> {
  const config = await getDHLConfig();
  const client = await getSoapClient(config);

  const args = {
    authData: getAuthData(config),
    shipments: {
      item: {
        shipmentId: shipmentId,
      },
    },
  };

  try {
    await client.deleteShipmentsAsync(args);
  } catch (error: unknown) {
    console.error("DHL deleteShipments error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`DHL API error: ${msg}`);
  }
}

interface DHLPickupData {
  senderName: string;
  senderStreet: string;
  senderCity: string;
  senderPostalCode: string;
  senderPhone: string;
  senderEmail: string;
  pickupDate: string;
  pickupTimeFrom: string;
  pickupTimeTo: string;
}

export async function requestDHLPickup(data: DHLPickupData): Promise<string> {
  const config = await getDHLConfig();
  const client = await getSoapClient(config);

  const senderAddr = parseAddress(data.senderStreet);

  const args = {
    authData: getAuthData(config),
    bookCourier: {
      pickupDate: data.pickupDate,
      pickupTimeFrom: data.pickupTimeFrom,
      pickupTimeTo: data.pickupTimeTo,
      contactPerson: data.senderName,
      contactPhone: data.senderPhone,
      contactEmail: data.senderEmail,
      senderName: data.senderName,
      senderPostalCode: cleanPostalCode(data.senderPostalCode),
      senderCity: data.senderCity,
      senderStreet: senderAddr.street,
      senderHouseNumber: senderAddr.houseNumber,
      ...(senderAddr.apartmentNumber ? { senderApartmentNumber: senderAddr.apartmentNumber } : {}),
    },
  };

  try {
    const [result] = await client.bookCourierAsync(args);
    const orderId = result?.orderId || result?.bookCourierResult || "OK";
    return String(orderId);
  } catch (error: unknown) {
    console.error("DHL bookCourier error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`DHL API error: ${msg}`);
  }
}
