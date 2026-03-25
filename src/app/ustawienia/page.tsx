"use client";

import { useEffect, useState } from "react";

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

const API_KEY_LABELS: Record<string, string> = {
  INPOST_API_TOKEN: "InPost API Token",
  INPOST_ORGANIZATION_ID: "InPost Organization ID",
  INPOST_API_URL: "InPost API URL",
  DHL_API_KEY: "DHL API Key",
  DHL_API_SECRET: "DHL API Secret",
  DHL_API_URL: "DHL API URL",
  DHL_ACCOUNT_NUMBER: "DHL Account Number",
  WHATSAPP_TOKEN: "WhatsApp Token",
  WHATSAPP_PHONE_NUMBER_ID: "WhatsApp Phone Number ID",
};

const API_KEY_GROUPS = [
  {
    name: "InPost",
    keys: ["INPOST_API_TOKEN", "INPOST_ORGANIZATION_ID", "INPOST_API_URL"],
  },
  {
    name: "DHL",
    keys: ["DHL_API_KEY", "DHL_API_SECRET", "DHL_API_URL", "DHL_ACCOUNT_NUMBER"],
  },
  {
    name: "WhatsApp",
    keys: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
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
  }, []);

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
