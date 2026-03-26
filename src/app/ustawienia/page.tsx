"use client";

import { useEffect, useState, useCallback } from "react";

interface CompanyAddress {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  contactPerson: string;
}

interface ApiKeySetting {
  key: string;
  value: string;
  hasValue: boolean;
}

interface WhatsAppStatus {
  isReady: boolean;
  hasQR: boolean;
  qrDataUrl: string | null;
  isInitializing: boolean;
  error?: string;
}

const API_KEY_LABELS: Record<string, string> = {
  INPOST_API_TOKEN: "InPost API Token",
  INPOST_ORGANIZATION_ID: "InPost Organization ID",
  INPOST_API_URL: "InPost API URL",
  DHL_API_LOGIN: "DHL Login APIv2",
  DHL_API_PASSWORD: "DHL Hasło APIv2",
  DHL_SAP_NUMBER: "DHL Numer SAP",
  DHL_API_URL: "DHL API URL (domyślnie: dhl24.com.pl/webapi2)",
};

const API_KEY_GROUPS = [
  {
    name: "InPost",
    keys: ["INPOST_API_TOKEN", "INPOST_ORGANIZATION_ID", "INPOST_API_URL"],
  },
  {
    name: "DHL (DHL24 Polska)",
    keys: [
      "DHL_API_LOGIN",
      "DHL_API_PASSWORD",
      "DHL_SAP_NUMBER",
      "DHL_API_URL",
    ],
  },
];

export default function UstawieniaPage() {
  const [address, setAddress] = useState<CompanyAddress>({
    name: "",
    street: "",
    city: "",
    postalCode: "",
    country: "PL",
    phone: "",
    email: "",
    contactPerson: "",
  });
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [existingKeys, setExistingKeys] = useState<Record<string, boolean>>({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [addressMsg, setAddressMsg] = useState("");
  const [keysMsg, setKeysMsg] = useState("");

  // WhatsApp state
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({
    isReady: false,
    hasQR: false,
    qrDataUrl: null,
    isInitializing: false,
  });
  const [waLoading, setWaLoading] = useState(false);

  const fetchWhatsAppStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Load company address
    fetch("/api/settings/company")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.name) {
          setAddress({
            name: data.name || "",
            street: data.street || "",
            city: data.city || "",
            postalCode: data.postalCode || "",
            country: data.country || "PL",
            phone: data.phone || "",
            email: data.email || "",
            contactPerson: data.contactPerson || "",
          });
        }
      });

    // Load API keys status
    fetch("/api/settings/apikeys")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const existing: Record<string, boolean> = {};
          data.forEach((s: ApiKeySetting) => {
            existing[s.key] = s.hasValue;
          });
          setExistingKeys(existing);
        }
      });

    // Load WhatsApp status
    fetchWhatsAppStatus();
  }, [fetchWhatsAppStatus]);

  // Auto-poll WhatsApp status when initializing or showing QR
  useEffect(() => {
    if (waStatus.isInitializing || (waStatus.hasQR && !waStatus.isReady)) {
      const interval = setInterval(fetchWhatsAppStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [waStatus.isInitializing, waStatus.hasQR, waStatus.isReady, fetchWhatsAppStatus]);

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setSavingAddress(true);
    setAddressMsg("");

    try {
      const res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(address),
      });

      if (res.ok) {
        setAddressMsg("Adres firmy został zapisany");
      } else {
        const data = await res.json();
        setAddressMsg(data.error || "Błąd zapisu");
      }
    } catch {
      setAddressMsg("Błąd połączenia");
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleSaveKeys(e: React.FormEvent) {
    e.preventDefault();
    setSavingKeys(true);
    setKeysMsg("");

    const settings = Object.entries(apiKeys)
      .filter(([, value]) => value.trim() !== "")
      .map(([key, value]) => ({ key, value }));

    if (settings.length === 0) {
      setKeysMsg("Brak zmian do zapisania");
      setSavingKeys(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/apikeys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (res.ok) {
        setKeysMsg("Klucze API zostały zapisane");
        setApiKeys({});
        // Refresh status
        const statusRes = await fetch("/api/settings/apikeys");
        const data = await statusRes.json();
        if (Array.isArray(data)) {
          const existing: Record<string, boolean> = {};
          data.forEach((s: ApiKeySetting) => {
            existing[s.key] = s.hasValue;
          });
          setExistingKeys(existing);
        }
      } else {
        const data = await res.json();
        setKeysMsg(data.error || "Błąd zapisu");
      }
    } catch {
      setKeysMsg("Błąd połączenia");
    } finally {
      setSavingKeys(false);
    }
  }

  async function handleWhatsAppAction(action: "connect" | "reconnect" | "disconnect") {
    setWaLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        // Wait a bit then refresh status
        setTimeout(fetchWhatsAppStatus, 2000);
      } else {
        const data = await res.json();
        setWaStatus((prev) => ({ ...prev, error: data.error }));
      }
    } catch {
      setWaStatus((prev) => ({ ...prev, error: "Błąd połączenia z serwerem" }));
    } finally {
      setWaLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ustawienia</h1>

      {/* Company Address */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Adres firmy (odbiorca na etykietach)
        </h2>
        <form onSubmit={handleSaveAddress} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nazwa firmy *
              </label>
              <input
                type="text"
                required
                value={address.name}
                onChange={(e) =>
                  setAddress({ ...address, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Osoba kontaktowa
              </label>
              <input
                type="text"
                value={address.contactPerson}
                onChange={(e) =>
                  setAddress({ ...address, contactPerson: e.target.value })
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
                value={address.phone}
                onChange={(e) =>
                  setAddress({ ...address, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ulica i numer *
              </label>
              <input
                type="text"
                required
                value={address.street}
                onChange={(e) =>
                  setAddress({ ...address, street: e.target.value })
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
                value={address.city}
                onChange={(e) =>
                  setAddress({ ...address, city: e.target.value })
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
                value={address.postalCode}
                onChange={(e) =>
                  setAddress({ ...address, postalCode: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="00-000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={address.email}
                onChange={(e) =>
                  setAddress({ ...address, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {addressMsg && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                addressMsg.includes("Błąd")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {addressMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={savingAddress}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {savingAddress ? "Zapisywanie..." : "Zapisz adres"}
          </button>
        </form>
      </div>

      {/* WhatsApp Connection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          WhatsApp
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Połącz WhatsApp, aby wysyłać etykiety do grup lub numerów telefonów.
          Zeskanuj kod QR aplikacją WhatsApp na telefonie.
        </p>

        {/* Status indicator */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-3 h-3 rounded-full ${
              waStatus.isReady
                ? "bg-green-500"
                : waStatus.isInitializing || waStatus.hasQR
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
            }`}
          />
          <span className="text-sm font-medium text-gray-700">
            {waStatus.isReady
              ? "Połączono z WhatsApp"
              : waStatus.isInitializing
                ? "Łączenie..."
                : waStatus.hasQR
                  ? "Oczekiwanie na skanowanie kodu QR"
                  : "Niepołączono"}
          </span>
        </div>

        {/* QR Code */}
        {waStatus.hasQR && waStatus.qrDataUrl && (
          <div className="mb-4 flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block">
              <img
                src={waStatus.qrDataUrl}
                alt="WhatsApp QR Code"
                width={300}
                height={300}
              />
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Otwórz WhatsApp na telefonie &rarr; Ustawienia &rarr; Połączone urządzenia &rarr; Połącz urządzenie
            </p>
          </div>
        )}

        {/* Initializing spinner */}
        {waStatus.isInitializing && !waStatus.hasQR && (
          <div className="mb-4 flex items-center gap-2 text-yellow-600">
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm">Uruchamianie WhatsApp...</span>
          </div>
        )}

        {waStatus.error && (
          <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
            {waStatus.error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!waStatus.isReady && !waStatus.isInitializing && !waStatus.hasQR && (
            <button
              onClick={() => handleWhatsAppAction("connect")}
              disabled={waLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {waLoading ? "Łączenie..." : "Połącz WhatsApp"}
            </button>
          )}
          {waStatus.isReady && (
            <button
              onClick={() => handleWhatsAppAction("disconnect")}
              disabled={waLoading}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Rozłącz
            </button>
          )}
          {(waStatus.isReady || waStatus.hasQR) && (
            <button
              onClick={() => handleWhatsAppAction("reconnect")}
              disabled={waLoading}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Odśwież / Nowy QR
            </button>
          )}
          <button
            onClick={fetchWhatsAppStatus}
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Odśwież status
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Klucze API
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Pozostaw puste pole, aby zachować istniejącą wartość. Wartości są
          maskowane ze względów bezpieczeństwa.
        </p>

        <form onSubmit={handleSaveKeys} className="space-y-6">
          {API_KEY_GROUPS.map((group) => (
            <div key={group.name}>
              <h3 className="font-medium text-gray-800 mb-3 border-b pb-2">
                {group.name}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {group.keys.map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="w-56 text-sm font-medium text-gray-700 flex-shrink-0">
                      {API_KEY_LABELS[key]}
                      {existingKeys[key] && (
                        <span className="ml-2 text-green-600 text-xs">
                          (skonfigurowany)
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={apiKeys[key] || ""}
                      onChange={(e) =>
                        setApiKeys({ ...apiKeys, [key]: e.target.value })
                      }
                      placeholder={
                        existingKeys[key]
                          ? "Pozostaw puste, aby nie zmieniać"
                          : "Wprowadź wartość"
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {keysMsg && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                keysMsg.includes("Błąd")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {keysMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={savingKeys}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {savingKeys ? "Zapisywanie..." : "Zapisz klucze API"}
          </button>
        </form>
      </div>
    </div>
  );
}
