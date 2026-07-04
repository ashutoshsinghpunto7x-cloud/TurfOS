import { supabase } from '../lib/supabase';
import { todayISOInIST } from './bookingService';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StaffAttendanceStatus {
  staffId:  string;
  fullName: string;
  present:  boolean;
  markedAt: string | null;
}

// ── Staff: mark / check today's attendance ─────────────────────────────────

export async function markAttendanceToday(staffId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('staff_attendance')
    .upsert(
      { staff_id: staffId, attendance_date: todayISOInIST() },
      { onConflict: 'staff_id,attendance_date', ignoreDuplicates: true },
    );
  return { error: error?.message ?? null };
}

export async function fetchMyAttendanceToday(staffId: string): Promise<{
  marked: boolean; markedAt: string | null;
}> {
  const { data } = await supabase
    .from('staff_attendance')
    .select('marked_at')
    .eq('staff_id', staffId)
    .eq('attendance_date', todayISOInIST())
    .maybeSingle();
  return { marked: !!data, markedAt: (data as any)?.marked_at ?? null };
}

// ── Owner: attendance roster for a given date ──────────────────────────────

export async function fetchAttendanceForDate(date: string): Promise<{
  records: StaffAttendanceStatus[]; error: string | null;
}> {
  const [{ data: staffProfiles, error: pErr }, { data: attendanceRows }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'staff').order('full_name'),
    supabase.from('staff_attendance').select('staff_id, marked_at').eq('attendance_date', date),
  ]);

  if (pErr) return { records: [], error: pErr.message };

  const markedMap = new Map<string, string>();
  (attendanceRows ?? []).forEach((r: any) => markedMap.set(r.staff_id, r.marked_at));

  const records: StaffAttendanceStatus[] = (staffProfiles ?? []).map((p: any) => ({
    staffId:  p.id,
    fullName: p.full_name ?? 'Staff',
    present:  markedMap.has(p.id),
    markedAt: markedMap.get(p.id) ?? null,
  }));

  return { records, error: null };
}
