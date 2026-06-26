import { Booking, Customer, POSItem, Transaction, InventoryItem, LedgerEntry } from '../types';

export const mockBookings: Booking[] = [
  { id: 'B001', customer: 'Rahul Singh',  phone: '98765 43210', slot: '06:00–07:00', date: 'Today',    field: 'Turf A', status: 'Confirmed', amount: 800,  paid: true  },
  { id: 'B002', customer: 'Amit Verma',   phone: '87654 32109', slot: '08:00–09:00', date: 'Today',    field: 'Turf B', status: 'Pending',   amount: 1200, paid: false },
  { id: 'B003', customer: 'Priya Nair',   phone: '76543 21098', slot: '10:00–11:00', date: 'Today',    field: 'Turf A', status: 'Completed', amount: 800,  paid: true  },
  { id: 'B004', customer: 'Suresh Kumar', phone: '65432 10987', slot: '17:00–18:00', date: 'Today',    field: 'Turf B', status: 'Cancelled', amount: 1200, paid: false },
  { id: 'B005', customer: 'Deepak Joshi', phone: '91234 56789', slot: '19:00–20:00', date: 'Tomorrow', field: 'Turf A', status: 'Confirmed', amount: 1000, paid: true  },
  { id: 'B006', customer: 'Neha Sharma',  phone: '99887 76655', slot: '20:00–21:00', date: 'Tomorrow', field: 'Turf B', status: 'Pending',   amount: 1200, paid: false },
];

export const mockCustomers: Customer[] = [
  { id: 'C001', name: 'Rahul Singh',  phone: '98765 43210', bookings: 12, credit: 500,  totalSpent: 14400, initials: 'RS' },
  { id: 'C002', name: 'Amit Verma',   phone: '87654 32109', bookings: 7,  credit: 1200, totalSpent: 9800,  initials: 'AV' },
  { id: 'C003', name: 'Priya Nair',   phone: '76543 21098', bookings: 5,  credit: 0,    totalSpent: 6000,  initials: 'PN' },
  { id: 'C004', name: 'Suresh Kumar', phone: '65432 10987', bookings: 3,  credit: 2400, totalSpent: 4800,  initials: 'SK' },
  { id: 'C005', name: 'Deepak Joshi', phone: '91234 56789', bookings: 9,  credit: 0,    totalSpent: 10800, initials: 'DJ' },
];

// ── PART 4: Visually distinct, unambiguous emoji per item ─────────────────
export const mockPOSItems: POSItem[] = [
  { id: 'P001', name: 'Tea',          emoji: '🍵', price: 20, category: 'Beverages', stock: 80 },
  { id: 'P002', name: 'Coffee',       emoji: '☕', price: 30, category: 'Beverages', stock: 60 },
  { id: 'P003', name: 'Water Bottle', emoji: '💧', price: 25, category: 'Beverages', stock: 45 },
  { id: 'P004', name: 'Energy Drink', emoji: '⚡', price: 80, category: 'Beverages', stock: 12 },
  { id: 'P005', name: 'Nimbu Pani',   emoji: '🍋', price: 30, category: 'Beverages', stock: 35 },
  { id: 'P006', name: 'Cold Coffee',  emoji: '🧋', price: 60, category: 'Beverages', stock: 8  },
  { id: 'P007', name: 'Banana',       emoji: '🍌', price: 15, category: 'Snacks',    stock: 20 },
  { id: 'P008', name: 'Biscuits',     emoji: '🍘', price: 20, category: 'Snacks',    stock: 30 },
  { id: 'P009', name: 'Chips',        emoji: '🥔', price: 30, category: 'Snacks',    stock: 25 },
];

export const mockTransactions: Transaction[] = [
  { id: 'T001', items: [{ name: 'Tea', qty: 2, price: 20 }, { name: 'Biscuits', qty: 1, price: 20 }], total: 60,  time: '08:42', date: 'Today', customer: 'Rahul Singh', undone: false },
  { id: 'T002', items: [{ name: 'Coffee', qty: 1, price: 30 }, { name: 'Energy Drink', qty: 1, price: 80 }],       total: 110, time: '09:15', date: 'Today', customer: 'Walk-in',     undone: false },
  { id: 'T003', items: [{ name: 'Water Bottle', qty: 3, price: 25 }],                                              total: 75,  time: '10:30', date: 'Today', customer: 'Priya Nair',  undone: true, undoneNote: 'Accidental tap' },
  { id: 'T004', items: [{ name: 'Nimbu Pani', qty: 2, price: 30 }],                                               total: 60,  time: '11:05', date: 'Today', customer: 'Walk-in',     undone: false },
];

export const mockInventory: InventoryItem[] = [
  { id: 'I001', name: 'Tea Powder',    emoji: '🫖', unit: 'kg',   stock: 2.5, minStock: 1,  maxStock: 10,  category: 'Beverages' },
  { id: 'I002', name: 'Coffee Powder', emoji: '☕', unit: 'kg',   stock: 1.2, minStock: 1,  maxStock: 8,   category: 'Beverages' },
  { id: 'I003', name: 'Water Bottles', emoji: '💧', unit: 'pcs',  stock: 45,  minStock: 20, maxStock: 200, category: 'Beverages' },
  { id: 'I004', name: 'Energy Drinks', emoji: '⚡', unit: 'pcs',  stock: 8,   minStock: 12, maxStock: 100, category: 'Beverages' },
  { id: 'I005', name: 'Sugar',         emoji: '🍬', unit: 'kg',   stock: 3.0, minStock: 1,  maxStock: 10,  category: 'Ingredients' },
  { id: 'I006', name: 'Turf Net',      emoji: '🥅', unit: 'pcs',  stock: 2,   minStock: 2,  maxStock: 10,  category: 'Equipment' },
  { id: 'I007', name: 'Footballs',     emoji: '⚽', unit: 'pcs',  stock: 8,   minStock: 4,  maxStock: 20,  category: 'Equipment' },
  { id: 'I008', name: 'Bibs (Set)',    emoji: '🎽', unit: 'sets', stock: 5,   minStock: 3,  maxStock: 15,  category: 'Equipment' },
];

export const mockLedger: LedgerEntry[] = [
  { id: 'L001', customer: 'Rahul Singh',  item: 'Booking – Turf A',   amount: 800,  type: 'credit', date: 'Apr 26', note: 'Pending payment'       },
  { id: 'L002', customer: 'Amit Verma',   item: 'Booking – Turf B',   amount: 1200, type: 'credit', date: 'Apr 25', note: 'Dues from last week'    },
  { id: 'L003', customer: 'Rahul Singh',  item: 'Cash received',       amount: 300,  type: 'debit',  date: 'Apr 24', note: 'Partial payment'        },
  { id: 'L004', customer: 'Suresh Kumar', item: 'Booking – Turf B x2', amount: 2400, type: 'credit', date: 'Apr 23', note: 'Match booking'          },
  { id: 'L005', customer: 'Priya Nair',   item: 'Advance cleared',     amount: 800,  type: 'debit',  date: 'Apr 22', note: 'Full payment received'  },
];

export const weekRevenue = [2400, 3600, 1800, 4200, 3100, 5400, 4800];
export const weekLabels  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];