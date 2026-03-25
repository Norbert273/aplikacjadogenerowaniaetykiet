"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  formatDate,
  getCarrierName,
  getStatusLabel,
  getStatusColor,
} from "@/lib/utils";

interface Shipment {
  id: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  senderName: string;
  recipientName: string;
  hasLabel: boolean;
  whatsappSent: boolean;
  createdAt: string;
  user: { name: string; email: string };
}

export default function PrzesylkiPage() {
  const { data: session } = useSession();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);

  // Pickup modal
  const [pickupShipmentId, setPickupShipmentId] = useState<string | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTimeFrom, setPickupTimeFrom] = useState("10:00");
  const [pickupTimeTo, setPickupTimeTo] = useState("16:00");
  const [pickupLoading, setPickupLoading] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    fetch("/api/shipments")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setShipments(data);
      })
      .finally(() => setLoading(false));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setPickupDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  async function handleSendWhatsApp(shipmentId: string) {
    setSendingWhatsApp(shipmentId);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId }),
      });

      if (res.ok) {
        setShipments((prev) =>
          prev.map((s) =>
            s.id === shipmentId
              ? { ...s, whatsappSent: true, status: "SENT_WHATSAPP" }
              : s
          )
        );
      } else {
        const data = await res.json();
        alert(data.error || "Błąd wysyłki WhatsApp");
      }
    } catch {
      alert("Błąd połączenia");
    } finally {
      setSendingWhatsApp(null);
    }
  }

  async function handleRequestPickup() {
    if (!pickupShipmentId) return;
    setPickupLoading(true);

    try {
      const res = await fetch("/api/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: pickupShipmentId,
          pickupDate,
          pickupTimeFrom,
          pickupTimeTo,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(
          `Kurier zamówiony! Numer potwierdzenia: ${data.confirmationNumber}`
        );
        setPickupShipmentId(null);
      } else {
        alert(data.error || "Błąd zamawiania kuriera");
      }
    } catch {
      alert("Błąd połączenia");
    } finally {
      setPickupLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Ładowanie...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Przesyłki</h1>

      {/* Pickup Modal */}
      {pickupShipmentId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Zamów odbiór kuriera
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Kurier przyjedzie pod adres nadawcy po odbiór paczki.
            </p>
            <div className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
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
                  className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {pickupLoading ? "Zamawianie..." : "Zamów kuriera"}
                </button>
                <button
                  onClick={() => setPickupShipmentId(null)}
                  className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shipments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Brak przesyłek</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Przewoźnik
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Nr śledzenia
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Nadawca
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Użytkownik
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(shipment.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          shipment.carrier === "INPOST"
                            ? "text-orange-600"
                            : "text-yellow-600"
                        }`}
                      >
                        {getCarrierName(shipment.carrier)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {shipment.trackingNumber || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {shipment.senderName}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-700">
                        {shipment.user.name}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}
                      >
                        {getStatusLabel(shipment.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {shipment.hasLabel && (
                          <a
                            href={`/api/labels/${shipment.id}/download`}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            PDF
                          </a>
                        )}
                        {shipment.hasLabel && !shipment.whatsappSent && (
                          <button
                            onClick={() => handleSendWhatsApp(shipment.id)}
                            disabled={sendingWhatsApp === shipment.id}
                            className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-50"
                          >
                            {sendingWhatsApp === shipment.id
                              ? "..."
                              : "WhatsApp"}
                          </button>
                        )}
                        {shipment.whatsappSent && (
                          <span className="text-green-600 text-xs">
                            Wysłano
                          </span>
                        )}
                        {shipment.hasLabel && (
                          <button
                            onClick={() => setPickupShipmentId(shipment.id)}
                            className="text-purple-600 hover:text-purple-800 text-xs font-medium"
                          >
                            Kurier
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
