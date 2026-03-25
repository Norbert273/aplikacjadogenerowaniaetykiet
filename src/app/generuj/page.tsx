"use client";

import { useState, useEffect } from "react";

interface SenderTemplate {
  id: string;
  name: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string | null;
  email: string | null;
}

interface CompanyAddress {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  contactPerson: string;
}

export default function GenerujPage() {
  const [carrier, setCarrier] = useState<"INPOST" | "DHL" | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    trackingNumber: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [companyAddress, setCompanyAddress] = useState<CompanyAddress | null>(
    null
  );
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);

  // Sender templates
  const [templates, setTemplates] = useState<SenderTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [sender, setSender] = useState({
    name: "",
    street: "",
    city: "",
    postalCode: "",
    phone: "",
    email: "",
  });

  const [parcelSize, setParcelSize] = useState("A");
  const [weight, setWeight] = useState("1");
  const [inpostService, setInpostService] = useState<"inpost_courier_standard" | "inpost_locker_standard">("inpost_courier_standard");
  const [targetPoint, setTargetPoint] = useState("");

  // Pickup
  const [showPickup, setShowPickup] = useState(false);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupResult, setPickupResult] = useState<string | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTimeFrom, setPickupTimeFrom] = useState("10:00");
  const [pickupTimeTo, setPickupTimeTo] = useState("16:00");

  useEffect(() => {
    // Load sender templates
    fetch("/api/sender-templates")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => {});

    // Load company address
    fetch("/api/settings/company")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.name) setCompanyAddress(data);
      })
      .catch(() => {});

    // Set default pickup date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setPickupDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  function handleSelectTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSender({
        name: template.name,
        street: template.street,
        city: template.city,
        postalCode: template.postalCode,
        phone: template.phone || "",
        email: template.email || "",
      });
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!carrier) return;

    setLoading(true);
    setError("");
    setResult(null);
    setWhatsappSent(false);
    setPickupResult(null);
    setShowPickup(false);

    const endpoint =
      carrier === "INPOST" ? "/api/labels/inpost" : "/api/labels/dhl";

    const payload = {
      senderName: sender.name,
      senderStreet: sender.street,
      senderCity: sender.city,
      senderPostalCode: sender.postalCode,
      senderPhone: sender.phone,
      senderEmail: sender.email,
      ...(carrier === "INPOST"
        ? { parcelSize, serviceType: inpostService, targetPoint: inpostService === "inpost_locker_standard" ? targetPoint : undefined }
        : { weight: parseFloat(weight) }),
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Wystąpił błąd");
      } else {
        setResult(data);
      }
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendWhatsApp() {
    if (!result) return;

    setWhatsappSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: result.id,
          phone: sender.phone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Błąd wysyłki WhatsApp");
      } else {
        setWhatsappSent(true);
      }
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setWhatsappSending(false);
    }
  }

  async function handleRequestPickup() {
    if (!result) return;

    setPickupLoading(true);
    setError("");

    try {
      const res = await fetch("/api/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: result.id,
          pickupDate,
          pickupTimeFrom,
          pickupTimeTo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Błąd zamawiania kuriera");
      } else {
        setPickupResult(data.confirmationNumber);
      }
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setPickupLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Generuj etykietę
      </h1>

      {/* Carrier Selection */}
      {!carrier && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <button
            onClick={() => setCarrier("INPOST")}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-8 hover:border-orange-400 hover:shadow-md transition-all text-left"
          >
            <div className="text-3xl font-bold text-orange-500 mb-2">
              InPost
            </div>
            <p className="text-gray-500 text-sm">
              Paczkomaty i kurierska dostawa InPost. Wybierz rozmiar paczki A, B
              lub C.
            </p>
          </button>

          <button
            onClick={() => setCarrier("DHL")}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-8 hover:border-yellow-400 hover:shadow-md transition-all text-left"
          >
            <div className="text-3xl font-bold text-yellow-600 mb-2">DHL</div>
            <p className="text-gray-500 text-sm">
              Kurier DHL Express. Podaj wagę paczki w kilogramach.
            </p>
          </button>
        </div>
      )}

      {/* Generation Form */}
      {carrier && !result && (
        <div className="max-w-2xl">
          <button
            onClick={() => setCarrier(null)}
            className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Zmień przewoźnika
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-1">
              Przewoźnik:{" "}
              <span
                className={
                  carrier === "INPOST" ? "text-orange-500" : "text-yellow-600"
                }
              >
                {carrier === "INPOST" ? "InPost" : "DHL"}
              </span>
            </h2>
          </div>

          <form onSubmit={handleGenerate} className="space-y-6">
            {/* Sender Template Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Dane nadawcy
              </h3>

              {templates.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wybierz z szablonu
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTemplate(t.id)}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          selectedTemplateId === t.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="font-medium text-sm">{t.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {t.street}, {t.postalCode} {t.city}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-b border-gray-200 mt-4 mb-4" />
                  <p className="text-xs text-gray-400 mb-2">
                    Lub wypełnij ręcznie:
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nazwa / Firma *
                  </label>
                  <input
                    type="text"
                    required
                    value={sender.name}
                    onChange={(e) =>
                      setSender({ ...sender, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={sender.phone}
                    onChange={(e) =>
                      setSender({ ...sender, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="+48..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ulica i numer *
                  </label>
                  <input
                    type="text"
                    required
                    value={sender.street}
                    onChange={(e) =>
                      setSender({ ...sender, street: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Miasto *
                  </label>
                  <input
                    type="text"
                    required
                    value={sender.city}
                    onChange={(e) =>
                      setSender({ ...sender, city: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kod pocztowy *
                  </label>
                  <input
                    type="text"
                    required
                    value={sender.postalCode}
                    onChange={(e) =>
                      setSender({ ...sender, postalCode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="00-000"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={sender.email}
                    onChange={(e) =>
                      setSender({ ...sender, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Parcel Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Dane paczki</h3>
              {carrier === "INPOST" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Typ usługi
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setInpostService("inpost_courier_standard")}
                        className={`p-3 rounded-lg border-2 text-center transition-colors ${
                          inpostService === "inpost_courier_standard"
                            ? "border-orange-400 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="font-semibold">Kurier</div>
                        <div className="text-xs text-gray-500">Dostawa pod adres</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInpostService("inpost_locker_standard")}
                        className={`p-3 rounded-lg border-2 text-center transition-colors ${
                          inpostService === "inpost_locker_standard"
                            ? "border-orange-400 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="font-semibold">Paczkomat</div>
                        <div className="text-xs text-gray-500">Dostawa do paczkomatu</div>
                      </button>
                    </div>
                  </div>

                  {inpostService === "inpost_locker_standard" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kod paczkomatu docelowego *
                      </label>
                      <input
                        type="text"
                        required
                        value={targetPoint}
                        onChange={(e) => setTargetPoint(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        placeholder="np. KRA010"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Kod paczkomatu InPost, do którego ma trafić paczka
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rozmiar paczki
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {
                          value: "A",
                          label: "A (mała)",
                          desc: "8 x 38 x 64 cm",
                        },
                        {
                          value: "B",
                          label: "B (średnia)",
                          desc: "19 x 38 x 64 cm",
                        },
                        {
                          value: "C",
                          label: "C (duża)",
                          desc: "41 x 38 x 64 cm",
                        },
                      ].map((size) => (
                        <button
                          key={size.value}
                          type="button"
                          onClick={() => setParcelSize(size.value)}
                          className={`p-3 rounded-lg border-2 text-center transition-colors ${
                            parcelSize === size.value
                              ? "border-orange-400 bg-orange-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="font-semibold">{size.label}</div>
                          <div className="text-xs text-gray-500">
                            {size.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Waga (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Recipient (Company) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Dane odbiorcy (adres firmy)
              </h3>
              {companyAddress ? (
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                  <p className="font-medium">{companyAddress.name}</p>
                  {companyAddress.contactPerson && (
                    <p>{companyAddress.contactPerson}</p>
                  )}
                  <p>{companyAddress.street}</p>
                  <p>
                    {companyAddress.postalCode} {companyAddress.city}
                  </p>
                  {companyAddress.phone && <p>Tel: {companyAddress.phone}</p>}
                  {companyAddress.email && (
                    <p>Email: {companyAddress.email}</p>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 text-yellow-700 rounded-lg p-4 text-sm">
                  Adres firmy nie został skonfigurowany. Poproś administratora o
                  uzupełnienie danych w ustawieniach.
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !companyAddress}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Generowanie etykiety..." : "Generuj etykietę"}
            </button>
          </form>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="max-w-2xl">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <h2 className="text-lg font-semibold text-green-800">
                Etykieta wygenerowana!
              </h2>
            </div>
            {result.trackingNumber && (
              <p className="text-green-700">
                Numer śledzenia:{" "}
                <span className="font-mono font-bold">
                  {result.trackingNumber}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <a
              href={`/api/labels/${result.id}/download`}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
            >
              Pobierz etykietę (PDF)
            </a>

            <button
              onClick={handleSendWhatsApp}
              disabled={whatsappSending || whatsappSent}
              className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {whatsappSent
                ? "Wysłano WhatsApp!"
                : whatsappSending
                  ? "Wysyłanie..."
                  : "Wyślij przez WhatsApp"}
            </button>
          </div>

          {/* Courier Pickup */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                Zamów odbiór kuriera
              </h3>
              {!showPickup && !pickupResult && (
                <button
                  onClick={() => setShowPickup(true)}
                  className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Zamów kuriera
                </button>
              )}
            </div>

            {pickupResult && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <p className="text-purple-800 font-medium">
                    Kurier zamówiony!
                  </p>
                </div>
                <p className="text-sm text-purple-700 mt-1">
                  Numer potwierdzenia:{" "}
                  <span className="font-mono">{pickupResult}</span>
                </p>
                <p className="text-sm text-purple-700">
                  Data: {pickupDate}, godz. {pickupTimeFrom} - {pickupTimeTo}
                </p>
              </div>
            )}

            {showPickup && !pickupResult && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Kurier przyjedzie pod adres nadawcy po odbiór paczki.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data odbioru
                    </label>
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Od godziny
                    </label>
                    <input
                      type="time"
                      value={pickupTimeFrom}
                      onChange={(e) => setPickupTimeFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Do godziny
                    </label>
                    <input
                      type="time"
                      value={pickupTimeTo}
                      onChange={(e) => setPickupTimeTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleRequestPickup}
                    disabled={pickupLoading}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {pickupLoading
                      ? "Zamawianie..."
                      : "Potwierdź odbiór kuriera"}
                  </button>
                  <button
                    onClick={() => setShowPickup(false)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setCarrier(null);
              setError("");
              setWhatsappSent(false);
              setPickupResult(null);
              setShowPickup(false);
              setSelectedTemplateId("");
              setSender({
                name: "",
                street: "",
                city: "",
                postalCode: "",
                phone: "",
                email: "",
              });
            }}
            className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Nowa etykieta
          </button>
        </div>
      )}
    </div>
  );
}
