export interface OrderItem {
  title: string;
  qty: number;
}

export interface Order {
  id: string;
  email: string;
  name: string;
  status: string;
  fulfillment: string;
  carrier?: string;
  tracking?: string;
  items: OrderItem[];
  placedAt: string;
  eta?: string;
  deliveredAt?: string;
  total: string;
}

export interface Product {
  id: string;
  title: string;
  price: string;
  options: string[];
  inStock: boolean;
}

export interface FaqEntry {
  id: string;
  topic: string;
  question: string;
  answer: string;
  keywords: string[];
}

export interface BookingSlot {
  id: string;
  topic: string;
  startsAt: string;
  durationMin: number;
}

export interface StoreData {
  orders: Order[];
  products: Product[];
  faq: FaqEntry[];
  booking: BookingSlot[];
}

export type Route = "deterministic" | "model" | "escalate" | "out_of_scope";

export interface Classification {
  message: string;
  email: string | null;
  channel: string;
  route: Route;
  intent: string;
  topics: string[];
  tool: string | null;
  toolInput: Record<string, unknown>;
  scopeOk: boolean;
  confidence: number;
  reason: string;
}

export interface ToolResult {
  reply: string;
  [key: string]: unknown;
}

export interface NewTicket {
  message: string;
  customerEmail: string | null;
  channel: string;
  intent: string | null;
  route: string | null;
  status: string;
  assignee: string | null;
  reply: string | null;
  confidence: number | null;
  metadata?: Record<string, unknown>;
}

export interface TicketRow extends NewTicket {
  id: number;
  createdAt: string;
}

export interface CacheEntry {
  response: Record<string, unknown>;
  source: string;
  hitCount: number;
}

export interface FailureRecord {
  workflow?: string;
  node?: string | null;
  error?: string;
  input?: unknown;
  [key: string]: unknown;
}
