//////////////////////////////
// ── NAVIGATION TYPES ──────
//////////////////////////////

export type RootStackParamList = {
  Dashboard: undefined;

  NewBooking: undefined;
  Credit: undefined;
  Inventory: undefined;
  Reports: undefined;

  Bookings: undefined;
  POS: undefined;

  Customers: undefined;

  BookingDetail: {
    bookingId: string;
  };

  CustomerDetail: {
    customerId: string;
  };
};

//////////////////////////////
// ── Auth / Profile ────────
//////////////////////////////

export type UserRole = 'owner' | 'admin' | 'staff' | 'customer';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  email?: string;
}

//////////////////////////////
// ── Payment ───────────────
//////////////////////////////

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'failed' | 'refunded';
export type PaymentType   = 'advance' | 'partial' | 'full';

export interface PaymentRecord {
  id: string;
  booking_id: string;
  amount: number;
  status: PaymentStatus;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  payment_type: PaymentType;
  note: string | null;
  created_at: string;
}

//////////////////////////////
// ── Credit Ledger ─────────
//////////////////////////////

export type CreditEntryType = 'credit' | 'debit';

export interface DBCreditEntry {
  id: string;
  customer: string;
  item: string;
  item_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  amount: number;
  entry_type: CreditEntryType;
  note: string;
  entry_date: string;
  created_by: string | null;
  created_at: string;
}

export interface CreditCustomerSummary {
  customer: string;
  total_credit: number;
  total_paid: number;
  outstanding: number;
  entry_count: number;
  last_activity: string;
}

//////////////////////////////
// ── Inventory ─────────────
//////////////////////////////

export interface DBInventoryItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  category: string;
  stock: number;
  min_stock: number;
  max_stock: number;
  unit: string;
  is_sellable: boolean;
  is_active: boolean;
  cost_price: number;
  created_at: string;
}

export interface DBRestockRecord {
  id: string;
  item_id: string;
  item_name: string;
  quantity_added: number;
  stock_before: number;
  stock_after: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

//////////////////////////////
// ── POS Transaction ───────
//////////////////////////////

export interface DBTransactionItem {
  id: string;
  transaction_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface DBTransaction {
  id: string;
  customer: string;
  total: number;
  status: 'completed' | 'undone';
  undo_reason: string | null;
  created_by: string | null;
  created_at: string;
  pos_transaction_items: DBTransactionItem[];
}

//////////////////////////////
// ── App Domain Types ──────
//////////////////////////////

export type BookingStatus = 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';

export interface Booking {
  id: string;
  customer: string;
  phone: string;
  slot: string;
  date: string;
  field: string;
  status: BookingStatus;
  amount: number;
  paid: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  bookings: number;
  credit: number;
  totalSpent: number;
  initials: string;
}

export interface POSItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  category: string;
  stock: number;
}

export interface Transaction {
  id: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  time: string;
  date: string;
  customer: string;
  undone: boolean;
  undoneNote?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  emoji: string;
  unit: string;
  stock: number;
  minStock: number;
  maxStock: number;
  category: string;
}

export interface LedgerEntry {
  id: string;
  customer: string;
  item: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  note: string;
}

export interface CartItem {
  posItem: POSItem;
  qty: number;
}