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
  carrierStatus: string | null;
  carrierStatusPl: string | null;
  carrierStatusAt: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

export default function PrzesylkiPage() {
  const { data: session } = useSession();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  // Pickup modal
  const [pickupShipmentId, setPickupShipmentId] = useState<string | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTimeFrom, setPickupTimeFrom] = useState("10:00");
  const [pickupTimeTo, setPickupTimeTo] = useState("16:00");
  const [pickupLoading, setPickupLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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

  async function handleCancel(shipmentId: string) {
    if (!confirm("Czy na pewno chcesz anulować tę przesyłkę?\n\nPrzesyłka zostanie anulowana i opłata nie zostanie pobrana (jeśli paczka nie została jeszcze nadana).")) return;

    setCancellingId(shipmentId);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/cancel`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.success) {
        setShipments((prev) =>
          prev.map((s) =>
            s.id === shipmentId
              ? { ...s, status: "ERROR" }
              : s
          )
        );
        alert(data.message || "Przesyłka anulowana");
      } else {
        alert(data.error || "Błąd anulowania");
      }
    } catch {
      alert("Błąd połączenia");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleRefreshTracking(shipmentId: string) {
    setTrackingId(shipmentId);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/track`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setShipments((prev) =>
          prev.map((s) =>
            s.id === shipmentId
              ? {
                  ...s,
                  carrierStatus: data.carrierStatus,
                  carrierStatusPl: data.carrierStatusPl,
                  carrierStatusAt: data.updatedAt,
                }
              : s
          )
        );
      } else {
        alert(data.error || "Błąd sprawdzania statusu");
      }
    } catch {
      alert("Błąd połączenia");
    } finally {
      setTrackingId(null);
    }
  }

  function formatTimeAgo(dateStr: string | null): string {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "przed chwilą";
    if (minutes < 60) return `${minutes} min temu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h temu`;
    const days = Math.floor(hours / 24);
    return `${days}d temu`;
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
                    Status paczki
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
                      <div className="flex items-center gap-2">
                        {shipment.carrierStatusPl ? (
                          <div>
                            <span className="text-xs font-medium text-gray-800">
                              {shipment.carrierStatusPl}
                            </span>
                            {shipment.carrierStatusAt && (
                              <div className="text-[10px] text-gray-400">
                                {formatTimeAgo(shipment.carrierStatusAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                        {shipment.hasLabel && (
                          <button
                            onClick={() => handleRefreshTracking(shipment.id)}
                            disabled={trackingId === shipment.id}
                            className="text-blue-500 hover:text-blue-700 disabled:opacity-50"
                            title="Odśwież status"
                          >
                            <svg
                              className={`w-4 h-4 ${trackingId === shipment.id ? "animate-spin" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
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
                        {shipment.status !== "ERROR" && (
                          <button
                            onClick={() => handleCancel(shipment.id)}
                            disabled={cancellingId === shipment.id}
                            className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50"
                          >
                            {cancellingId === shipment.id ? "..." : "Anuluj"}
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
