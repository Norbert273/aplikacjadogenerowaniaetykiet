"use client";

import { useEffect, useState } from "react";

interface SenderTemplate {
  id: string;
  name: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string | null;
  email: string | null;
  defaultCarrier: string | null;
  whatsappGroupId: string | null;
  whatsappGroupName: string | null;
}

interface WhatsAppGroup {
  id: string;
  name: string;
  participantCount: number;
}

const emptyForm = {
  name: "",
  street: "",
  city: "",
  postalCode: "",
  country: "PL",
  phone: "",
  email: "",
  defaultCarrier: "",
  whatsappGroupId: "",
  whatsappGroupName: "",
};

export default function NadawcyPage() {
  const [templates, setTemplates] = useState<SenderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // WhatsApp groups
  const [waGroups, setWaGroups] = useState<WhatsAppGroup[]>([]);
  const [waGroupsLoading, setWaGroupsLoading] = useState(false);
  const [waGroupsError, setWaGroupsError] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const res = await fetch("/api/sender-templates");
      const data = await res.json();
      if (Array.isArray(data)) setTemplates(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadWhatsAppGroups() {
    setWaGroupsLoading(true);
    setWaGroupsError("");
    try {
      const res = await fetch("/api/whatsapp/groups");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setWaGroups(data);
      } else {
        const data = await res.json();
        setWaGroupsError(data.error || "Nie można pobrać grup");
      }
    } catch {
      setWaGroupsError("Błąd połączenia");
    } finally {
      setWaGroupsLoading(false);
    }
  }

  function handleEdit(template: SenderTemplate) {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      street: template.street,
      city: template.city,
      postalCode: template.postalCode,
      country: template.country,
      phone: template.phone || "",
      email: template.email || "",
      defaultCarrier: template.defaultCarrier || "",
      whatsappGroupId: template.whatsappGroupId || "",
      whatsappGroupName: template.whatsappGroupName || "",
    });
    setShowForm(true);
    setError("");
    loadWhatsAppGroups();
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    setError("");
  }

  function handleShowNewForm() {
    setShowForm(true);
    setEditingId(null);
    setFormData(emptyForm);
    loadWhatsAppGroups();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = editingId
        ? `/api/sender-templates/${editingId}`
        : "/api/sender-templates";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Wystąpił błąd");
      } else {
        handleCancel();
        loadTemplates();
      }
    } catch {
      setError("Błąd połączenia");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Czy na pewno chcesz usunąć szablon "${name}"?`)) return;

    try {
      const res = await fetch(`/api/sender-templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadTemplates();
      } else {
        const data = await res.json();
        alert(data.error || "Błąd usuwania");
      }
    } catch {
      alert("Błąd połączenia");
    }
  }

  function getCarrierLabel(carrier: string | null): string {
    if (carrier === "INPOST") return "InPost";
    if (carrier === "DHL") return "DHL";
    return "";
  }

  function getCarrierColor(carrier: string | null): string {
    if (carrier === "INPOST") return "text-orange-600 bg-orange-50";
    if (carrier === "DHL") return "text-yellow-700 bg-yellow-50";
    return "";
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Szablony nadawców
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Szablony dostępne dla wszystkich użytkowników przy generowaniu
            etykiet
          </p>
        </div>
        {!showForm && (
          <button
            onClick={handleShowNewForm}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Dodaj szablon
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            {editingId ? "Edytuj szablon" : "Nowy szablon nadawcy"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nazwa firmy / nadawcy *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="np. Firma XYZ Sp. z o.o."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ulica i numer *
                </label>
                <input
                  type="text"
                  required
                  value={formData.street}
                  onChange={(e) =>
                    setFormData({ ...formData, street: e.target.value })
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
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
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
                  value={formData.postalCode}
                  onChange={(e) =>
                    setFormData({ ...formData, postalCode: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="00-000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="+48..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domyślny kurier
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, defaultCarrier: "" })
                    }
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      formData.defaultCarrier === ""
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    Brak
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, defaultCarrier: "INPOST" })
                    }
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      formData.defaultCarrier === "INPOST"
                        ? "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    InPost
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, defaultCarrier: "DHL" })
                    }
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      formData.defaultCarrier === "DHL"
                        ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    DHL
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Po wybraniu szablonu kurier zostanie automatycznie ustawiony
                </p>
              </div>

              {/* WhatsApp Group */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grupa WhatsApp
                </label>
                {waGroupsLoading ? (
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 animate-spin"
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
                    Ładowanie grup WhatsApp...
                  </div>
                ) : waGroupsError ? (
                  <div className="text-sm text-gray-500">
                    <p className="text-yellow-600 mb-2">{waGroupsError}</p>
                    <button
                      type="button"
                      onClick={loadWhatsAppGroups}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Spróbuj ponownie
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      value={formData.whatsappGroupId}
                      onChange={(e) => {
                        const groupId = e.target.value;
                        const group = waGroups.find((g) => g.id === groupId);
                        setFormData({
                          ...formData,
                          whatsappGroupId: groupId,
                          whatsappGroupName: group?.name || "",
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
                    >
                      <option value="">Brak (wyślij na numer telefonu)</option>
                      {waGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    {waGroups.length === 0 && !waGroupsError && (
                      <p className="text-xs text-gray-400 mt-1">
                        Brak grup. Połącz WhatsApp w ustawieniach lub odśwież listę.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={loadWhatsAppGroups}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium mt-1"
                    >
                      Odśwież grupy
                    </button>
                  </>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Etykieta zostanie wysłana do wybranej grupy WhatsApp
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving
                  ? "Zapisywanie..."
                  : editingId
                    ? "Zapisz zmiany"
                    : "Dodaj szablon"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Brak szablonów nadawców</p>
          <p className="text-sm text-gray-400 mt-1">
            Dodaj pierwszy szablon, aby użytkownicy mogli go wybierać przy
            generowaniu etykiet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{t.name}</h3>
                {t.defaultCarrier && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCarrierColor(t.defaultCarrier)}`}
                  >
                    {getCarrierLabel(t.defaultCarrier)}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{t.street}</p>
                <p>
                  {t.postalCode} {t.city}
                </p>
                {t.phone && <p>Tel: {t.phone}</p>}
                {t.email && <p>Email: {t.email}</p>}
                {t.whatsappGroupName && (
                  <p className="flex items-center gap-1 text-green-600">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.604-.768-6.41-2.07l-.16-.12-3.352 1.124 1.124-3.352-.12-.16A9.935 9.935 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
                    </svg>
                    {t.whatsappGroupName}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleEdit(t)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Edytuj
                </button>
                <button
                  onClick={() => handleDelete(t.id, t.name)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Usuń
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
