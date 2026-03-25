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
}

const emptyForm = {
  name: "",
  street: "",
  city: "",
  postalCode: "",
  country: "PL",
  phone: "",
  email: "",
};

export default function NadawcyPage() {
  const [templates, setTemplates] = useState<SenderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
    });
    setShowForm(true);
    setError("");
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    setError("");
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
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData(emptyForm);
            }}
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
              <h3 className="font-semibold text-gray-900 mb-2">{t.name}</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{t.street}</p>
                <p>
                  {t.postalCode} {t.city}
                </p>
                {t.phone && <p>Tel: {t.phone}</p>}
                {t.email && <p>Email: {t.email}</p>}
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
