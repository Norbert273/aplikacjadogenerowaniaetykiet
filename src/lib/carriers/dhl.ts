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

interface DHLConfig {
  username: string;
  password: string;
  sapNumber: string;
  apiUrl: string;
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
  const apiUrl =
    urlSetting?.value ||
    process.env.DHL_API_URL ||
    "https://dhl24.com.pl/webapi2";

  if (!username || !password || !sapNumber) {
    throw new Error(
      "Brak konfiguracji DHL API. Uzupełnij Login APIv2, Hasło APIv2 i Numer SAP w ustawieniach."
    );
  }

  return { username, password, sapNumber, apiUrl };
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

// Build SOAP XML envelope
function buildSoapEnvelope(method: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.dpd.com.pl/webapi2">
  <soapenv:Body>
    <ws:${method}>
      ${body}
    </ws:${method}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function authDataXml(config: DHLConfig): string {
  return `<authData>
    <username>${escapeXml(config.username)}</username>
    <password>${escapeXml(config.password)}</password>
  </authData>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function soapCall(config: DHLConfig, method: string, body: string): Promise<string> {
  const envelope = buildSoapEnvelope(method, body);

  console.log(`DHL SOAP call: ${method}`);

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": method,
    },
    body: envelope,
  });

  const responseText = await response.text();

  if (!response.ok) {
    // Extract fault message from SOAP response
    const faultMatch = responseText.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
    const detailMatch = responseText.match(/<detail>([\s\S]*?)<\/detail>/);
    const errorMsg = faultMatch?.[1] || detailMatch?.[1] || responseText.substring(0, 500);
    throw new Error(`DHL API error: ${response.status} - ${errorMsg}`);
  }

  return responseText;
}

// Extract value from XML by tag name
function extractXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>(.*?)</(?:[^:]+:)?${tag}>`, "s");
  const match = xml.match(regex);
  return match?.[1]?.trim() || "";
}

// Extract all values for a tag
function extractAllXmlValues(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>(.*?)</(?:[^:]+:)?${tag}>`, "gs");
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

export async function createDHLShipment(
  data: DHLShipmentData
): Promise<{ shipmentId: string; trackingNumber: string }> {
  const config = await getDHLConfig();

  const senderAddr = parseAddress(data.senderStreet);
  const recipientAddr = parseAddress(data.recipientStreet);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const shipmentDate = tomorrow.toISOString().split("T")[0];

  const body = `
    ${authDataXml(config)}
    <shipments>
      <item>
        <shipper>
          <name>${escapeXml(data.senderName)}</name>
          <postalCode>${escapeXml(cleanPostalCode(data.senderPostalCode))}</postalCode>
          <city>${escapeXml(data.senderCity)}</city>
          <street>${escapeXml(senderAddr.street)}</street>
          <houseNumber>${escapeXml(senderAddr.houseNumber)}</houseNumber>
          ${senderAddr.apartmentNumber ? `<apartmentNumber>${escapeXml(senderAddr.apartmentNumber)}</apartmentNumber>` : ""}
          <contactPerson>${escapeXml(data.senderName)}</contactPerson>
          <contactPhone>${escapeXml(data.senderPhone)}</contactPhone>
          <contactEmail>${escapeXml(data.senderEmail)}</contactEmail>
        </shipper>
        <receiver>
          <name>${escapeXml(data.recipientName)}</name>
          <postalCode>${escapeXml(cleanPostalCode(data.recipientPostalCode))}</postalCode>
          <city>${escapeXml(data.recipientCity)}</city>
          <street>${escapeXml(recipientAddr.street)}</street>
          <houseNumber>${escapeXml(recipientAddr.houseNumber)}</houseNumber>
          ${recipientAddr.apartmentNumber ? `<apartmentNumber>${escapeXml(recipientAddr.apartmentNumber)}</apartmentNumber>` : ""}
          <contactPerson>${escapeXml(data.recipientName)}</contactPerson>
          <contactPhone>${escapeXml(data.recipientPhone)}</contactPhone>
          <contactEmail>${escapeXml(data.recipientEmail)}</contactEmail>
          <country>PL</country>
        </receiver>
        <pieceList>
          <item>
            <type>PACKAGE</type>
            <weight>${Math.max(1, Math.round(data.weight))}</weight>
            <width>30</width>
            <height>20</height>
            <length>40</length>
            <quantity>1</quantity>
            <nonStandard>false</nonStandard>
          </item>
        </pieceList>
        <payment>
          <shippingPaymentType>SHIPPER</shippingPaymentType>
          <billingAccountNumber>${escapeXml(config.sapNumber)}</billingAccountNumber>
          <paymentType>BANK_TRANSFER</paymentType>
        </payment>
        <service>
          <product>AH</product>
          <collectOnDelivery>false</collectOnDelivery>
          <insurance>false</insurance>
        </service>
        <shipmentDate>${shipmentDate}</shipmentDate>
        <content>Przesylka</content>
        <reference>LABEL-${Date.now()}</reference>
        <skipRestrictionCheck>true</skipRestrictionCheck>
      </item>
    </shipments>`;

  const responseXml = await soapCall(config, "createShipments", body);

  console.log("DHL createShipments response (first 1000 chars):", responseXml.substring(0, 1000));

  const shipmentId = extractXmlValue(responseXml, "shipmentId");

  if (!shipmentId) {
    // Check for error
    const errorMsg = extractXmlValue(responseXml, "value") || extractXmlValue(responseXml, "message");
    throw new Error(`DHL: nie udało się utworzyć przesyłki. ${errorMsg || "Brak shipmentId w odpowiedzi."}`);
  }

  return {
    shipmentId,
    trackingNumber: shipmentId, // DHL24 uses shipmentId as tracking number
  };
}

export async function getDHLLabel(shipmentId: string): Promise<Buffer> {
  const config = await getDHLConfig();

  const body = `
    ${authDataXml(config)}
    <itemsToPrint>
      <item>
        <labelType>BLP</labelType>
        <shipmentId>${escapeXml(shipmentId)}</shipmentId>
      </item>
    </itemsToPrint>`;

  const responseXml = await soapCall(config, "getLabels", body);

  const labelData = extractXmlValue(responseXml, "labelData");

  if (!labelData) {
    throw new Error("DHL: nie udało się pobrać etykiety. Brak danych etykiety w odpowiedzi.");
  }

  return Buffer.from(labelData, "base64");
}

export async function deleteDHLShipment(shipmentId: string): Promise<void> {
  const config = await getDHLConfig();

  const body = `
    ${authDataXml(config)}
    <shipments>
      <item>
        <shipmentId>${escapeXml(shipmentId)}</shipmentId>
      </item>
    </shipments>`;

  await soapCall(config, "deleteShipments", body);
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

  const senderAddr = parseAddress(data.senderStreet);

  const body = `
    ${authDataXml(config)}
    <bookCourier>
      <pickupDate>${escapeXml(data.pickupDate)}</pickupDate>
      <pickupTimeFrom>${escapeXml(data.pickupTimeFrom)}</pickupTimeFrom>
      <pickupTimeTo>${escapeXml(data.pickupTimeTo)}</pickupTimeTo>
      <contactPerson>${escapeXml(data.senderName)}</contactPerson>
      <contactPhone>${escapeXml(data.senderPhone)}</contactPhone>
      <contactEmail>${escapeXml(data.senderEmail)}</contactEmail>
      <senderName>${escapeXml(data.senderName)}</senderName>
      <senderPostalCode>${escapeXml(cleanPostalCode(data.senderPostalCode))}</senderPostalCode>
      <senderCity>${escapeXml(data.senderCity)}</senderCity>
      <senderStreet>${escapeXml(senderAddr.street)}</senderStreet>
      <senderHouseNumber>${escapeXml(senderAddr.houseNumber)}</senderHouseNumber>
      ${senderAddr.apartmentNumber ? `<senderApartmentNumber>${escapeXml(senderAddr.apartmentNumber)}</senderApartmentNumber>` : ""}
    </bookCourier>`;

  const responseXml = await soapCall(config, "bookCourier", body);

  const orderId = extractXmlValue(responseXml, "orderId") ||
    extractXmlValue(responseXml, "bookCourierResult") ||
    "OK";

  return orderId;
}
