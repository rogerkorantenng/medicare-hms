/**
 * The operational half of the Repository: everything added when the
 * system went from something you could demonstrate to something you
 * could run.
 *
 * Kept beside types.ts rather than inside it because that file is the
 * contract the submitted design describes, and these are additions to
 * it. Both are re-exported from ./types so a screen still imports one
 * place.
 */
import type { Role } from './types';

// ---- catalogues, replacing the hardcoded arrays ----
export interface CatalogueItem {
  id: number;
  kind: 'lab' | 'imaging' | 'tariff';
  name: string;
  bodyRegion: string | null;
  price: number;
  isActive: boolean;
}

export interface NewCatalogueItem {
  kind: CatalogueItem['kind'];
  name: string;
  bodyRegion?: string | null;
  price: number;
}

// ---- stock ----
export interface StockMovement {
  id: number;
  itemId: number;
  kind: 'received' | 'adjusted' | 'dispensed';
  quantity: number;
  reason: string | null;
  movedByName: string | null;
  movedAt: string;
}

export interface NewInventoryItem {
  name: string;
  category?: string | null;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  expiryDate?: string | null;
}

export interface InventoryPatch {
  category?: string | null;
  reorderLevel?: number;
  unitPrice?: number;
  expiryDate?: string | null;
}

// ---- rosters ----
export interface Shift {
  id: number;
  doctorId: string;
  dayOfWeek: number;
  dayName: string;
  startsAt: string;
  endsAt: string;
  slotMinutes: number;
}

export interface LeaveEntry {
  id: number;
  doctorId: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
}

export interface Roster {
  shifts: Shift[];
  leave: LeaveEntry[];
}

// ---- money ----
export interface PaymentEntry {
  id: number;
  invoiceId: string;
  amount: number;
  method: string;
  provider: string | null;
  reason: string | null;
  takenByName: string | null;
  takenAt: string;
}

// ---- reports ----
export interface Summary {
  appointments: number;
  didNotAttend: number;
  cancelled: number;
  consultations: number;
  collected: number;
  refunded: number;
  writtenOff: number;
  patients: number;
}

export interface StaffMessage {
  toStaffId: string;
  title: string;
  body: string;
  kind?: 'info' | 'critical';
}

export interface PortalAccess {
  email: string;
  password: string;
}

export type { Role };
