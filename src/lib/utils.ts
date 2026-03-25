export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getCarrierName(carrier: string): string {
  switch (carrier) {
    case "INPOST":
      return "InPost";
    case "DHL":
      return "DHL";
    default:
      return carrier;
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Oczekuje";
    case "LABEL_GENERATED":
      return "Etykieta wygenerowana";
    case "SENT_WHATSAPP":
      return "Wysłano WhatsApp";
    case "ERROR":
      return "Błąd";
    default:
      return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "LABEL_GENERATED":
      return "bg-green-100 text-green-800";
    case "SENT_WHATSAPP":
      return "bg-blue-100 text-blue-800";
    case "ERROR":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
