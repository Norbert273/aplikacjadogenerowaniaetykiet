import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}

export interface ShipmentFormData {
  carrier: "INPOST" | "DHL";
  senderName: string;
  senderStreet: string;
  senderCity: string;
  senderPostalCode: string;
  senderPhone: string;
  senderEmail: string;
  parcelSize?: string;
  weight?: number;
}

export interface CompanyAddressData {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  contactPerson: string;
}

export interface UserFormData {
  email: string;
  name: string;
  password: string;
  phone?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  companyName?: string;
}
