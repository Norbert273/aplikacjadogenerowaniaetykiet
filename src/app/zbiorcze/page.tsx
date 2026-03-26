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
  defaultCarrier: string | null;
  whatsappGroupId: string | null;
  whatsappGroupName: string | null;
}

interface BatchItem {
  templateId: string;
  template: SenderTemplate;
  selected: boolean;
  carrierOverride: "INPOST" | "DHL" | null;
  status:
    | "idle"
    | "generating"
    | "success"
    | "error"
    | "sending"
    | "sent"
    | "send_error";
  shipmentId: string | null;
  trackingNumber: string | null;
  errorMessage: string | null;
}

export default function ZbiorczePage() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [parcelSize, setParcelSize] = useState("A");
  const [weight, setWeight] = useState("1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    fetch("/api/sender-templates")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(
            data.map((t: SenderTemplate) => ({
              templateId: t.id,
              template: t,
              selected: false,
              carrierOverride: null,
              status: "idle" as const,
              shipmentId: null,
              trackingNumber: null,
              errorMessage: null,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, []);

  function updateItem(templateId: string, updates: Partial<BatchItem>) {
    setItems((prev) =>
      prev.map((i) => (i.templateId === templateId ? { ...i, ...updates } : i))
    );
  }

  function toggleSelect(templateId: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.templateId === templateId ? { ...i, selected: !i.selected } : i
      )
    );
  }

  function selectAll() {
    setItems((prev) => prev.map((i) => ({ ...i, selected: true })));
  }

  function deselectAll() {
    setItems((prev) => prev.map((i) => ({ ...i, selected: false })));
  }

  const selectedItems = items.filter((i) => i.selected);
  const hasInpost = selectedItems.some(
    (i) => (i.template.defaultCarrier || i.carrierOverride) === "INPOST"
  );
  const hasDhl = selectedItems.some(
    (i) => (i.template.defaultCarrier || i.carrierOverride) === "DHL"
  );
  const allSelectedHaveCarrier = selectedItems.every(
    (i) => i.template.defaultCarrier || i.carrierOverride
  );
  const hasAnyResult = items.some(
    (i) => i.status !== "idle" && i.status !== "generating"
  );
  const successItems = items.filter((i) => i.status === "success" || i.status === "sent");
  const whatsappEligible = successItems.filter(
    (i) => i.template.whatsappGroupId
  );

  function getCarrier(item: BatchItem): "INPOST" | "DHL" | null {
    return (item.template.defaultCarrier as "INPOST" | "DHL" | null) || item.carrierOverride;
  }

  async function handleGenerateAll() {
    setIsGenerating(true);

    // Reset statuses for selected items
    for (const item of selectedItems) {
      updateItem(item.templateId, {
        status: "idle",
        shipmentId: null,
        trackingNumber: null,
        errorMessage: null,
      });
    }

    for (const item of selectedItems) {
      const carrier = getCarrier(item);
      if (!carrier) continue;

      updateItem(item.templateId, { status: "generating" });

      const endpoint =
        carrier === "INPOST" ? "/api/labels/inpost" : "/api/labels/dhl";
      const payload = {
        senderName: item.template.name,
        senderStreet: item.template.street,
        senderCity: item.template.city,
        senderPostalCode: item.template.postalCode,
        senderPhone: item.template.phone || "",
        senderEmail: item.template.email || "",
        ...(carrier === "INPOST"
          ? { parcelSize }
          : { weight: parseFloat(weight) }),
      };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Nieznany błąd");
        updateItem(item.templateId, {
          status: "success",
          shipmentId: data.id,
          trackingNumber: data.trackingNumber,
        });
      } catch (err) {
        updateItem(item.templateId, {
          status: "error",
          errorMessage:
            err instanceof Error ? err.message : "Nieznany błąd",
        });
      }
    }

    setIsGenerating(false);
  }

  async function handleSendAll() {
    setIsSending(true);

    const eligible = items.filter(
      (i) =>
        (i.status === "success") &&
        i.template.whatsappGroupId &&
        i.shipmentId
    );

    for (const item of eligible) {
      updateItem(item.templateId, { status: "sending" });

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shipmentId: item.shipmentId,
            phone: item.template.phone || "",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Błąd WhatsApp");
        updateItem(item.templateId, { status: "sent" });
      } catch (err) {
        updateItem(item.templateId, {
          status: "send_error",
          errorMessage:
            err instanceof Error ? err.message : "Błąd WhatsApp",
        });
      }
    }

    setIsSending(false);
  }

  async function handleRetrySingle(item: BatchItem) {
    const carrier = getCarrier(item);
    if (!carrier) return;

    updateItem(item.templateId, {
      status: "generating",
      errorMessage: null,
      shipmentId: null,
      trackingNumber: null,
    });

    const endpoint =
      carrier === "INPOST" ? "/api/labels/inpost" : "/api/labels/dhl";
    const payload = {
      senderName: item.template.name,
      senderStreet: item.template.street,
      senderCity: item.template.city,
      senderPostalCode: item.template.postalCode,
      senderPhone: item.template.phone || "",
      senderEmail: item.template.email || "",
      ...(carrier === "INPOST"
        ? { parcelSize }
        : { weight: parseFloat(weight) }),
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nieznany błąd");
      updateItem(item.templateId, {
        status: "success",
        shipmentId: data.id,
        trackingNumber: data.trackingNumber,
      });
    } catch (err) {
      updateItem(item.templateId, {
        status: "error",
        errorMessage:
          err instanceof Error ? err.message : "Nieznany błąd",
      });
    }
  }

  async function handleSendSingle(item: BatchItem) {
    if (!item.shipmentId || !item.template.whatsappGroupId) return;

    updateItem(item.templateId, { status: "sending" });

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: item.shipmentId,
          phone: item.template.phone || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd WhatsApp");
      updateItem(item.templateId, { status: "sent" });
    } catch (err) {
      updateItem(item.templateId, {
        status: "send_error",
        errorMessage:
          err instanceof Error ? err.message : "Błąd WhatsApp",
      });
    }
  }

  function handleReset() {
    setItems((prev) =>
      prev.map((i) => ({
        ...i,
        selected: false,
        status: "idle" as const,
        shipmentId: null,
        trackingNumber: null,
        errorMessage: null,
      }))
    );
  }

  if (loadingTemplates) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Zbiorcze generowanie etykiet
        </h1>
        <div className="text-gray-500">Ładowanie szablonów...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Zbiorcze generowanie etykiet
        </h1>
        <div className="bg-yellow-50 text-yellow-700 rounded-lg p-4 text-sm">
          Brak szablonów nadawców. Dodaj szablony w zakładce &quot;Szablony
          nadawców&quot;.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Zbiorcze generowanie etykiet
      </h1>

      {/* Template Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">
            Wybierz szablony nadawców
          </h2>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              disabled={isGenerating}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
            >
              Zaznacz wszystkie
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={deselectAll}
              disabled={isGenerating}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50"
            >
              Odznacz
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const carrier = getCarrier(item);
            return (
              <div
                key={item.templateId}
                className={`flex items-center gap-4 p-3 rounded-lg border-2 transition-colors ${
                  item.selected
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleSelect(item.templateId)}
                  disabled={isGenerating}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">
                    {item.template.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {item.template.street}, {item.template.postalCode}{" "}
                    {item.template.city}
                  </div>
                </div>

                {/* Carrier badge or selector */}
                <div className="flex-shrink-0">
                  {item.template.defaultCarrier ? (
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.template.defaultCarrier === "INPOST"
                          ? "text-orange-600 bg-orange-50"
                          : "text-yellow-700 bg-yellow-50"
                      }`}
                    >
                      {item.template.defaultCarrier === "INPOST"
                        ? "InPost"
                        : "DHL"}
                    </span>
                  ) : (
                    <select
                      value={item.carrierOverride || ""}
                      onChange={(e) =>
                        updateItem(item.templateId, {
                          carrierOverride:
                            (e.target.value as "INPOST" | "DHL") || null,
                        })
                      }
                      disabled={isGenerating}
                      className={`text-xs border rounded-lg px-2 py-1 ${
                        !item.carrierOverride
                          ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Wybierz kuriera</option>
                      <option value="INPOST">InPost</option>
                      <option value="DHL">DHL</option>
                    </select>
                  )}
                </div>

                {/* WhatsApp group */}
                <div className="flex-shrink-0 text-xs">
                  {item.template.whatsappGroupName ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      </svg>
                      {item.template.whatsappGroupName}
                    </span>
                  ) : (
                    <span className="text-gray-400">brak grupy</span>
                  )}
                </div>

                {/* Status indicator (during/after generation) */}
                {item.status !== "idle" && (
                  <div className="flex-shrink-0">
                    {item.status === "generating" && (
                      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {item.status === "success" && (
                      <svg
                        className="w-5 h-5 text-green-500"
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
                    )}
                    {item.status === "error" && (
                      <svg
                        className="w-5 h-5 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                    {item.status === "sending" && (
                      <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {item.status === "sent" && (
                      <span className="text-green-600 text-xs font-medium">
                        Wysłano
                      </span>
                    )}
                    {item.status === "send_error" && (
                      <span className="text-red-500 text-xs font-medium">
                        Błąd WA
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Parcel Settings */}
      {selectedItems.length > 0 && !hasAnyResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {hasInpost && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                <span className="text-orange-500">InPost</span> - rozmiar paczki
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "A", label: "A (mała)", desc: "8 x 38 x 64 cm" },
                  {
                    value: "B",
                    label: "B (średnia)",
                    desc: "19 x 38 x 64 cm",
                  },
                  { value: "C", label: "C (duża)", desc: "41 x 38 x 64 cm" },
                ].map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => setParcelSize(size.value)}
                    disabled={isGenerating}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      parcelSize === size.value
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-semibold text-sm">{size.label}</div>
                    <div className="text-xs text-gray-500">{size.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {hasDhl && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                <span className="text-yellow-600">DHL</span> - waga paczki
              </h3>
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
                  disabled={isGenerating}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generate button */}
      {!hasAnyResult && (
        <button
          onClick={handleGenerateAll}
          disabled={
            isGenerating ||
            selectedItems.length === 0 ||
            !allSelectedHaveCarrier
          }
          className="w-full max-w-md bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {isGenerating
            ? `Generowanie... (${items.filter((i) => i.status === "success").length}/${selectedItems.length})`
            : selectedItems.length === 0
              ? "Zaznacz szablony do wygenerowania"
              : !allSelectedHaveCarrier
                ? "Wybierz kuriera dla wszystkich szablonów"
                : `Generuj etykiety (${selectedItems.length})`}
        </button>
      )}

      {/* Results section */}
      {hasAnyResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Wyniki</h2>

          {/* Progress bar */}
          {isGenerating && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Postęp generowania</span>
                <span>
                  {items.filter((i) => i.status === "success" || i.status === "error").length}
                  /{selectedItems.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(items.filter((i) => i.status === "success" || i.status === "error").length / selectedItems.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {items
              .filter((i) => i.status !== "idle")
              .map((item) => (
                <div
                  key={item.templateId}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    item.status === "success" || item.status === "sent"
                      ? "border-green-200 bg-green-50"
                      : item.status === "error" || item.status === "send_error"
                        ? "border-red-200 bg-red-50"
                        : item.status === "sending"
                          ? "border-green-200 bg-green-50"
                          : "border-gray-200"
                  }`}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {item.status === "generating" && (
                      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {(item.status === "success" || item.status === "sent") && (
                      <svg
                        className="w-5 h-5 text-green-500"
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
                    )}
                    {(item.status === "error" ||
                      item.status === "send_error") && (
                      <svg
                        className="w-5 h-5 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                    {item.status === "sending" && (
                      <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>

                  {/* Template info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {item.template.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          getCarrier(item) === "INPOST"
                            ? "text-orange-600 bg-orange-100"
                            : "text-yellow-700 bg-yellow-100"
                        }`}
                      >
                        {getCarrier(item) === "INPOST" ? "InPost" : "DHL"}
                      </span>
                    </div>
                    {item.trackingNumber && (
                      <div className="text-xs text-gray-600 font-mono mt-0.5">
                        {item.trackingNumber}
                      </div>
                    )}
                    {item.errorMessage && (
                      <div className="text-xs text-red-600 mt-0.5">
                        {item.errorMessage}
                      </div>
                    )}
                    {item.status === "sent" && (
                      <div className="text-xs text-green-600 mt-0.5">
                        Wysłano przez WhatsApp do{" "}
                        {item.template.whatsappGroupName}
                      </div>
                    )}
                    {item.status === "send_error" && (
                      <div className="text-xs text-red-600 mt-0.5">
                        Błąd wysyłki WhatsApp: {item.errorMessage}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-2">
                    {(item.status === "success" || item.status === "sent") &&
                      item.shipmentId && (
                        <a
                          href={`/api/labels/${item.shipmentId}/download`}
                          className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg font-medium hover:bg-blue-200 transition-colors"
                        >
                          PDF
                        </a>
                      )}
                    {item.status === "success" &&
                      item.template.whatsappGroupId && (
                        <button
                          onClick={() => handleSendSingle(item)}
                          className="text-xs bg-green-100 text-green-700 px-2.5 py-1.5 rounded-lg font-medium hover:bg-green-200 transition-colors"
                        >
                          WhatsApp
                        </button>
                      )}
                    {(item.status === "error" ||
                      item.status === "send_error") && (
                      <button
                        onClick={() =>
                          item.status === "error"
                            ? handleRetrySingle(item)
                            : handleSendSingle(item)
                        }
                        className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                      >
                        Ponów
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Batch WhatsApp send */}
          {!isGenerating && successItems.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {whatsappEligible.length > 0 && (
                <button
                  onClick={handleSendAll}
                  disabled={isSending}
                  className="bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending
                    ? `Wysyłanie... (${items.filter((i) => i.status === "sent").length}/${whatsappEligible.length})`
                    : `Wyślij wszystkie przez WhatsApp (${whatsappEligible.length})`}
                </button>
              )}

              {successItems.length > whatsappEligible.length && (
                <div className="flex items-center text-xs text-gray-500">
                  {successItems.length - whatsappEligible.length} bez
                  przypisanej grupy WhatsApp - pominięte
                </div>
              )}
            </div>
          )}

          {/* Reset button */}
          {!isGenerating && !isSending && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleReset}
                className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
              >
                Nowa generacja
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
