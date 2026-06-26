import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Turf {
  id:         string;
  owner_id:   string;
  name:       string;
  slug:       string;
  qr_url:     string | null;
  open_time:  string;
  close_time: string;
  created_at: string;
}

// ── Slug generator ─────────────────────────────────────────────────────────

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    + '-' + Math.random().toString(36).slice(2, 7);
}

// ── Fetch owner's turf ─────────────────────────────────────────────────────

export async function fetchOwnerTurf(ownerId: string): Promise<{
  turf: Turf | null; error: string | null;
}> {
  const { data, error } = await supabase
    .from('turfs').select('*').eq('owner_id', ownerId).limit(1).single();
  if (error && error.code !== 'PGRST116') return { turf: null, error: error.message };
  return { turf: (data ?? null) as Turf | null, error: null };
}

// ── Create or get turf record ─────────────────────────────────────────────

export async function upsertTurf(params: {
  ownerId:   string;
  name:      string;
  openTime?: string;
  closeTime?:string;
}): Promise<{ turf: Turf | null; error: string | null }> {
  // Check if already exists
  const { turf: existing } = await fetchOwnerTurf(params.ownerId);
  if (existing) return { turf: existing, error: null };

  const slug = makeSlug(params.name);
  const { data, error } = await supabase
    .from('turfs')
    .insert({
      owner_id:   params.ownerId,
      name:       params.name.trim(),
      slug,
      open_time:  params.openTime  ?? '06:00',
      close_time: params.closeTime ?? '23:00',
    })
    .select().single();

  if (error || !data) return { turf: null, error: error?.message ?? 'Failed to create turf.' };
  return { turf: data as Turf, error: null };
}

// ── Save QR URL back to turf record ──────────────────────────────────────

export async function saveQRUrl(turfId: string, qrUrl: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('turfs').update({ qr_url: qrUrl }).eq('id', turfId);
  return { error: error?.message ?? null };
}

// ── Public booking status (used by web page too via REST) ─────────────────

export interface PublicSlotStatus {
  slot:   string;
  status: 'available' | 'booked' | 'ongoing';
  sport:  string | null;
}

export interface PublicTurfStatus {
  turf:      Turf;
  date:      string;
  slots:     PublicSlotStatus[];
  openTime:  string;
  closeTime: string;
}

// Build hourly slots between open and close
function buildSlots(openTime: string, closeTime: string): string[] {
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  const slots: string[] = [];
  let cur = oh * 60 + (om || 0);
  const end = ch * 60 + (cm || 0);
  while (cur < end) {
    const h   = Math.floor(cur / 60);
    const nxt = cur + 60;
    const nh  = Math.floor(nxt / 60);
    const fmt = (hh: number) => {
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const disp = hh % 12 === 0 ? 12 : hh % 12;
      return `${String(disp).padStart(2, '0')}:00 ${ampm}`;
    };
    slots.push(`${fmt(h)}–${fmt(nh)}`);
    cur += 60;
  }
  return slots;
}

export async function fetchPublicTurfStatus(slug: string, date: string): Promise<{
  status: PublicTurfStatus | null; error: string | null;
}> {
  // Fetch turf by slug
  const { data: turfData, error: turfErr } = await supabase
    .from('turfs').select('*').eq('slug', slug).single();
  if (turfErr || !turfData) return { status: null, error: 'Turf not found.' };
  const turf = turfData as Turf;

  // Fetch bookings for date — only safe public fields
  const { data: bookings, error: bookErr } = await supabase
    .from('bookings')
    .select('slot, status, sport, booking_date')
    .eq('booking_date', date)
    .eq('turf', turf.name)
    .neq('status', 'Cancelled');

  if (bookErr) return { status: null, error: bookErr.message };

  // Build slot grid
  const allSlots = buildSlots(turf.open_time, turf.close_time);
  const now      = new Date();
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  const isToday  = date === now.toISOString().slice(0, 10);

  const bookedMap: Record<string, { sport: string | null; status: string }> = {};
  for (const b of (bookings ?? [])) {
    bookedMap[b.slot] = { sport: b.sport, status: b.status };
  }

  const slots: PublicSlotStatus[] = allSlots.map((slot) => {
    const booking = bookedMap[slot];
    if (!booking) return { slot, status: 'available', sport: null };

    // Determine if ongoing: check if current time is within this slot
    let slotStatus: 'booked' | 'ongoing' = 'booked';
    if (isToday && booking.status === 'Confirmed') {
      // Parse slot start time
      try {
        const startStr = slot.split('–')[0].trim();
        const [timeStr, ampm] = startStr.split(' ');
        let [sh] = timeStr.split(':').map(Number);
        if (ampm === 'PM' && sh !== 12) sh += 12;
        if (ampm === 'AM' && sh === 12) sh = 0;
        const startMin = sh * 60;
        const endMin   = startMin + 60;
        if (nowMin >= startMin && nowMin < endMin) slotStatus = 'ongoing';
      } catch { /* ignore */ }
    }

    return { slot, status: slotStatus, sport: booking.sport };
  });

  return { status: { turf, date, slots, openTime: turf.open_time, closeTime: turf.close_time }, error: null };
}