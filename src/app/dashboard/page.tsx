"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  total: number;
  inpost: number;
  dhl: number;
  whatsappSent: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats>({ total: 0, inpost: 0, dhl: 0, whatsappSent: 0 });

  useEffect(() => {
    fetch("/api/shipments")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStats({
            total: data.length,
            inpost: data.filter((s: { carrier: string }) => s.carrier === "INPOST").length,
            dhl: data.filter((s: { carrier: string }) => s.carrier === "DHL").length,
            whatsappSent: data.filter((s: { whatsappSent: boolean }) => s.whatsappSent).length,
          });
        }
      });
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Witaj, {session?.user?.name}!
        </h1>
        <p className="text-gray-500 mt-1">
          Panel generatora etykiet wysyłkowych
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Wszystkie przesyłki" value={stats.total} color="blue" />
        <StatCard title="InPost" value={stats.inpost} color="orange" />
        <StatCard title="DHL" value={stats.dhl} color="yellow" />
        <StatCard title="Wysłano WhatsApp" value={stats.whatsappSent} color="green" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/generuj"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Generuj etykietę</h3>
              <p className="text-sm text-gray-500">
                Wybierz przewoźnika i wygeneruj etykietę wysyłkową
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/przesylki"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Historia przesyłek</h3>
              <p className="text-sm text-gray-500">
                Przeglądaj i pobieraj wygenerowane etykiety
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    yellow: "bg-yellow-50 text-yellow-700",
    green: "bg-green-50 text-green-700",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${colorMap[color]?.split(" ")[1] || "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}
