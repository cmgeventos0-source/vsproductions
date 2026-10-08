export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order?: number;
};

export type Venue = {
  id: string;
  name: string;
  city: string;
  address: string | null;
};

export type Event = {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  venue_id: string | null;
  description: string | null;
  image_url: string | null;
  sale_mode: "general" | "assigned";
  status: "draft" | "published" | "ended" | "cancelled";
  created_at: string;
  category?: Category | null;
  venue?: Venue | null;
  functions?: EventFunction[];
  next_function?: EventFunction | null;
};

export type EventFunction = {
  id: string;
  event_id: string;
  name: string | null;
  starts_at: string;
  doors_open_at: string | null;
  sales_start_at: string | null;
  sales_end_at: string | null;
  is_active: boolean;
  zones?: Zone[];
};

export type Zone = {
  id: string;
  function_id: string;
  name: string;
  price: number;
  presale_price?: number | null;
  presale_end_at?: string | null;
  sale_type?: "individual" | "full_zone";
  capacity: number | null;
  sold_count: number;
  color: string;
  sort_order: number;
  map_coords?: string | null;
  parent_id?: string | null;
  available?: number;
};


export type Seat = {
  id: string;
  zone_id: string;
  function_id: string;
  row_name: string;
  number: string;
  status: "available" | "held" | "sold";
  hold_expires_at: string | null;
};

export type PaymentMethod =
  | "nequi_direct"
  | "daviplata_direct"
  | "bancolombia_direct"
  | "wompi"
  | "cash_taquilla";

export type OrderStatus = "pending" | "pending_approval" | "paid" | "rejected" | "cancelled";

export type Order = {
  id: string;
  user_id: string | null;
  email: string;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_id_number?: string | null;
  status: OrderStatus;
  subtotal: number;
  service_fee: number;
  tax: number;
  total: number;
  currency: string;
  payment_method: PaymentMethod | string | null;
  payment_ref: string | null;
  receipt_url?: string | null;
  wompi_transaction_id?: string | null;
  created_at: string;
  tickets?: Ticket[];
};

export type Ticket = {
  id: string;
  order_id: string;
  function_id: string | null;
  zone_id: string | null;
  seat_id: string | null;
  holder_name: string | null;
  code: string;
  qr_data: string;
  status: "active" | "redeemed" | "transferred" | "cancelled";
  issued_at: string;
  redeemed_at: string | null;
  order?: Order | null;
  zone?: Zone | null;
  seat?: Seat | null;
  function?: EventFunction & { event?: Event } | null;
};

export type AppConfig = {
  company_name: { name: string } | null;
  currency: { value: string };
  tax_rate: { value: number };
  service_fee_fixed: { value: number };
  service_fee_percent: { value: number };
  hold_minutes: { value: number };
};

export type CartItem = {
  zoneId: string;
  quantity: number;
  seatIds?: string[];
};
