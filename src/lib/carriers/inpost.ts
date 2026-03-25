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
  targetPoint?: string; // Paczkomat code (required for locker service)
  serviceType?: string; // "inpost_locker_standard" or "inpost_courier_standard"
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
  const rawApiUrl =
    urlSetting?.value ||
    process.env.INPOST_API_URL ||
    "https://api-shipx-pl.easypack24.net/v1";
  // Remove trailing slash to avoid double slashes
  const apiUrl = rawApiUrl.replace(/\/+$/, "");

  if (!token || !organizationId) {
    throw new Error(
      "Brak konfiguracji InPost API. Uzupełnij token i ID organizacji w ustawieniach."
    );
  }

  return { token, organizationId, apiUrl };
}

// Parse name into company_name + first_name + last_name for InPost API
function parsePersonName(fullName: string): {
  company_name: string;
  first_name: string;
  last_name: string;
} {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    // If looks like a person name (2-3 words), use as first/last
    // Otherwise treat as company name
    const looksLikeCompany =
      parts.length > 3 ||
      /sp\.|s\.a\.|z o\.o\.|ltd|gmbh|inc|s\.c\.|s\.j\./i.test(trimmed);
    if (looksLikeCompany) {
      return { company_name: trimmed, first_name: trimmed, last_name: trimmed };
    }
    return {
      company_name: trimmed,
      first_name: parts[0],
      last_name: parts.slice(1).join(" "),
    };
  }
  // Single word - use for all fields
  return { company_name: trimmed, first_name: trimmed, last_name: trimmed };
}

// Parse street like "Kwiatowa 15" or "ul. Kwiatowa 15/3" into street + building_number
function parseStreetAndBuilding(fullStreet: string): {
  street: string;
  building_number: string;
} {
  const trimmed = fullStreet.trim();
  // Match building number at the end: "Kwiatowa 15", "Kwiatowa 15/3", "Kwiatowa 15A"
  const match = trimmed.match(/^(.+?)\s+(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?)$/);
  if (match) {
    return { street: match[1], building_number: match[2] };
  }
  // Fallback: use entire string as street, empty building number
  return { street: trimmed, building_number: "" };
}

export async function createInPostShipment(data: InPostShipmentData) {
  const config = await getInPostConfig();

  const senderAddr = parseStreetAndBuilding(data.senderStreet);
  const recipientAddr = parseStreetAndBuilding(data.recipientStreet);
  const senderPerson = parsePersonName(data.senderName);
  const recipientPerson = parsePersonName(data.recipientName);

  const serviceType = data.serviceType || "inpost_courier_standard";
  const isLocker = serviceType === "inpost_locker_standard";

  // Build receiver based on service type
  const receiver: Record<string, unknown> = {
    company_name: recipientPerson.company_name,
    first_name: recipientPerson.first_name,
    last_name: recipientPerson.last_name,
    phone: data.recipientPhone,
    email: data.recipientEmail,
  };
  // Locker shipments don't need receiver address, courier ones do
  if (!isLocker) {
    receiver.address = {
      street: recipientAddr.street,
      building_number: recipientAddr.building_number,
      city: data.recipientCity,
      post_code: data.recipientPostalCode,
      country_code: "PL",
    };
  }

  // Build parcels - locker uses template names, courier uses explicit dimensions
  const parcels = isLocker
    ? [{ template: getLockerTemplate(data.parcelSize) }]
    : [
        {
          dimensions: getParcelDimensions(data.parcelSize),
          weight: { amount: 1, unit: "kg" },
        },
      ];

  const shipmentPayload: Record<string, unknown> = {
    receiver,
    sender: {
      company_name: senderPerson.company_name,
      first_name: senderPerson.first_name,
      last_name: senderPerson.last_name,
      phone: data.senderPhone,
      email: data.senderEmail,
      address: {
        street: senderAddr.street,
        building_number: senderAddr.building_number,
        city: data.senderCity,
        post_code: data.senderPostalCode,
        country_code: "PL",
      },
    },
    parcels,
    service: serviceType,
    custom_attributes: {
      sending_method: "dispatch_order",
      ...(isLocker && data.targetPoint ? { target_point: data.targetPoint } : {}),
    },
    reference: `LABEL-${Date.now()}`,
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
  const shipmentId = result.id;

  console.log("InPost create response - id:", shipmentId, "status:", result.status);

  // After creation, we need to wait for offers to be prepared, then buy
  if (result.status !== "confirmed") {
    // Step 1: Wait for offers to be ready
    const offerId = await waitForOffers(config, shipmentId);

    // Step 2: Buy the shipment with the offer_id
    await buyInPostShipment(config, shipmentId, offerId);

    // Step 3: Wait for confirmation after buying
    await waitForShipmentConfirmation(config, shipmentId);
  }

  // Fetch final shipment data to get tracking number
  const finalData = await getShipmentData(config, shipmentId);

  return {
    shipmentId,
    trackingNumber: finalData.tracking_number || result.tracking_number,
    status: finalData.status || "confirmed",
  };
}

async function getShipmentData(
  config: { token: string; apiUrl: string },
  shipmentId: string
) {
  const response = await fetch(
    `${config.apiUrl}/shipments/${shipmentId}`,
    {
      headers: { Authorization: `Bearer ${config.token}` },
    }
  );
  if (response.ok) {
    return await response.json();
  }
  return {};
}

async function waitForOffers(
  config: { token: string; apiUrl: string },
  shipmentId: string,
  maxAttempts = 15
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const shipment = await getShipmentData(config, shipmentId);
    console.log(`InPost poll #${i + 1} - status: ${shipment.status}, offers: ${shipment.offers?.length || 0}`);

    // If already confirmed (auto-buy in simplified mode), no need to buy
    if (shipment.status === "confirmed" || shipment.status === "dispatched") {
      console.log("InPost: auto-confirmed by simplified mode, skipping buy");
      return 0; // Signal that no buy is needed
    }

    // Check if offers are available (for offer mode)
    if (shipment.offers && shipment.offers.length > 0) {
      const offerId = Number(shipment.offers[0].id);
      console.log("InPost offer found:", offerId);
      return offerId;
    }

    // If selected_offer exists, use that
    if (shipment.selected_offer?.id) {
      const offerId = Number(shipment.selected_offer.id);
      console.log("InPost selected_offer found:", offerId);
      return offerId;
    }
  }

  throw new Error("InPost: oferty nie zostały przygotowane w czasie. Spróbuj ponownie.");
}

async function buyInPostShipment(
  config: { token: string; organizationId: string; apiUrl: string },
  shipmentId: string,
  offerId: number
) {
  // offerId === 0 means shipment was auto-confirmed, skip buy
  if (offerId === 0) {
    console.log("InPost: shipment already confirmed, skipping buy");
    return;
  }

  const body = { offer_id: offerId };

  console.log("InPost buy request:", JSON.stringify({
    url: `${config.apiUrl}/shipments/${shipmentId}/buy`,
    body
  }));

  const response = await fetch(
    `${config.apiUrl}/shipments/${shipmentId}/buy`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`InPost buy error: ${response.status} - ${errorData}`);
  }
}

async function waitForShipmentConfirmation(
  config: { token: string; apiUrl: string },
  shipmentId: string,
  maxAttempts = 10
) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const response = await fetch(`${config.apiUrl}/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });

    if (response.ok) {
      const shipment = await response.json();
      if (shipment.status === "confirmed" || shipment.status === "dispatched") {
        return;
      }
      if (shipment.status === "cancelled" || shipment.status === "error") {
        throw new Error(`Przesyłka InPost ma status: ${shipment.status}`);
      }
    }
  }
  // Continue anyway - label might be available
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

interface InPostPickupData {
  shipmentId: string;
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

export async function requestInPostPickup(data: InPostPickupData): Promise<string> {
  const config = await getInPostConfig();

  const senderAddr = parseStreetAndBuilding(data.senderStreet);

  const payload = {
    shipments: [data.shipmentId],
    address: {
      street: senderAddr.street,
      building_number: senderAddr.building_number,
      city: data.senderCity,
      post_code: data.senderPostalCode,
      country_code: "PL",
    },
    phone: data.senderPhone,
    email: data.senderEmail,
    name: data.senderName,
    pickup_date: data.pickupDate,
    min_time: data.pickupTimeFrom,
    max_time: data.pickupTimeTo,
    comment: "Odbiór paczki - Generator Etykiet",
  };

  const response = await fetch(
    `${config.apiUrl}/organizations/${config.organizationId}/dispatch_orders`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`InPost Pickup API error: ${response.status} - ${errorData}`);
  }

  const result = await response.json();
  return result.id?.toString() || result.dispatch_order_id?.toString() || "OK";
}

export async function cancelInPostShipment(shipmentId: string): Promise<void> {
  const config = await getInPostConfig();

  const response = await fetch(
    `${config.apiUrl}/shipments/${shipmentId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`InPost cancel error: ${response.status} - ${errorData}`);
  }
}

function getLockerTemplate(size: string): string {
  switch (size) {
    case "A": return "small";
    case "B": return "medium";
    case "C": return "large";
    default: return "small";
  }
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
