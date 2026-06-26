import { create } from 'zustand';
import {
  Booking, Customer, POSItem, Transaction,
  InventoryItem, LedgerEntry, CartItem, UserProfile,
} from '../types';
import {
  mockBookings, mockCustomers, mockPOSItems,
  mockTransactions, mockInventory, mockLedger,
} from '../data/mockData';

interface AuthSlice {
  profile: UserProfile | null;
  profileMissing: boolean;           // ← new
  setProfile: (profile: UserProfile | null) => void;
  isOwnerOrAdmin: () => boolean;
}

interface DomainSlice {
  bookings: Booking[];
  customers: Customer[];
  posItems: POSItem[];
  transactions: Transaction[];
  inventory: InventoryItem[];
  ledger: LedgerEntry[];
  cart: Record<string, CartItem>;

  addBooking: (b: Booking) => void;
  updateBookingStatus: (id: string, status: Booking['status']) => void;
  addToCart: (item: POSItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  confirmSale: (customer: string) => Transaction;
  undoTransaction: (id: string) => void;
  addLedgerEntry: (entry: Omit<LedgerEntry, 'id'>) => void;
  restockItem: (id: string, qty: number) => void;
}

type StoreState = AuthSlice & DomainSlice;

export const useStore = create<StoreState>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────
  profile:        null,
  profileMissing: false,

  setProfile: (profile) => set({ profile, profileMissing: false }),

  isOwnerOrAdmin: () => {
    const role = get().profile?.role;
    return role === 'owner' || role === 'admin';
  },

  // ── Domain (unchanged) ────────────────────────────────────────────────
  bookings:     mockBookings,
  customers:    mockCustomers,
  posItems:     mockPOSItems,
  transactions: mockTransactions,
  inventory:    mockInventory,
  ledger:       mockLedger,
  cart:         {},

  addBooking: (b) => set((s) => ({ bookings: [b, ...s.bookings] })),

  updateBookingStatus: (id, status) =>
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, status } : b)) })),

  addToCart: (item) =>
    set((s) => {
      const existing = s.cart[item.id];
      return {
        cart: {
          ...s.cart,
          [item.id]: existing
            ? { posItem: item, qty: existing.qty + 1 }
            : { posItem: item, qty: 1 },
        },
      };
    }),

  removeFromCart: (itemId) =>
    set((s) => {
      const existing = s.cart[itemId];
      if (!existing) return s;
      if (existing.qty <= 1) {
        const next = { ...s.cart };
        delete next[itemId];
        return { cart: next };
      }
      return { cart: { ...s.cart, [itemId]: { ...existing, qty: existing.qty - 1 } } };
    }),

  clearCart: () => set({ cart: {} }),

  confirmSale: (customer) => {
    const { cart } = get();
    const items = Object.values(cart).map((c) => ({
      name: c.posItem.name, qty: c.qty, price: c.posItem.price,
    }));
    const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const now = new Date();
    const tx: Transaction = {
      id: `T${Date.now()}`, items, total,
      time: now.toTimeString().slice(0, 5),
      date: 'Today', customer, undone: false,
    };
    set((s) => ({ transactions: [tx, ...s.transactions], cart: {} }));
    return tx;
  },

  undoTransaction: (id) =>
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === id ? { ...t, undone: true, undoneNote: 'Undone by owner' } : t,
      ),
    })),

  addLedgerEntry: (entry) =>
    set((s) => ({ ledger: [{ ...entry, id: `L${Date.now()}` }, ...s.ledger] })),

  restockItem: (id, qty) =>
    set((s) => ({
      inventory: s.inventory.map((i) => i.id === id ? { ...i, stock: i.stock + qty } : i),
    })),
}));