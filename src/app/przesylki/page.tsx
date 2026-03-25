"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { formatDate, getCarrierName, getStatusLabel, getStatusColor } from "@/lib/utils";

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

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    fetch("/api/shipments")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setShipments(data);
      })
      .finally(() => setLoading(false));
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
                            Pobierz PDF
                          </a>
                        )}
                        {shipment.hasLabel && !shipment.whatsappSent && (
                          <button
                            onClick={() => handleSendWhatsApp(shipment.id)}
                            disabled={sendingWhatsApp === shipment.id}
                            className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-50"
                          >
                            {sendingWhatsApp === shipment.id
                              ? "Wysyłanie..."
                              : "WhatsApp"}
                          </button>
                        )}
                        {shipment.whatsappSent && (
                          <span className="text-green-600 text-xs">
                            Wysłano
                          </span>
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
