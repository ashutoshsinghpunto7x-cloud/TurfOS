import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Image, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store/useStore';
import {
  fetchPendingRequests, fetchAllRequests,
  approveBookingRequest, rejectBookingRequest, BookingRequest,
} from '../services/bookingRequestService';
import {
  fetchAccountRequests, approveAccountRequest, rejectAccountRequest,
} from '../services/authService';
import {
  cancelBooking, editBookingTime, fetchBookingsForDate, BookingSlot,
} from '../services/bookingService';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:      '#FAFAFC',
  surface: '#FFFFFF',
  grad0:   '#7C4DFF',
  grad1:   '#8B5CF6',
  grad2:   '#60A5FA',
  text:    '#1A1A1A',
  text2:   '#7B7B8A',
  text3:   '#AEAEBB',
  white:   '#FFFFFF',
  border:  'rgba(0,0,0,0.06)',
  okTxt:   '#10B981',
  okBg:    'rgba(16,185,129,0.09)',
  okBd:    'rgba(16,185,129,0.22)',
  redTxt:  '#EF4444',
  redBg:   'rgba(239,68,68,0.07)',
  redBd:   'rgba(239,68,68,0.20)',
  warnTxt: '#D97706',
  warnBg:  'rgba(251,191,36,0.09)',
  infoBg:  'rgba(59,130,246,0.07)',
  infoTxt: '#3B82F6',
  infoBd:  'rgba(59,130,246,0.22)',
  autoBg:  'rgba(16,185,129,0.06)',
  autoBd:  'rgba(16,185,129,0.18)',
  autoTxt: '#10B981',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function canManageBookings(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'staff';
}

function statusColor(status: string): string {
  if (status === 'approved' || status === 'auto_approved') return T.okTxt;
  if (status === 'rejected') return T.redTxt;
  return T.grad0;
}
function statusBg(status: string): string {
  if (status === 'approved' || status === 'auto_approved') return T.okBg;
  if (status === 'rejected') return T.redBg;
  return 'rgba(124,77,255,0.09)';
}
function statusBd(status: string): string {
  if (status === 'approved' || status === 'auto_approved') return T.okBd;
  if (status === 'rejected') return T.redBd;
  return 'rgba(124,77,255,0.22)';
}
function statusLabel(status: string): string {
  if (status === 'auto_approved') return 'Auto-Booked';
  if (status === 'approved')      return 'Approved';
  if (status === 'rejected')      return 'Rejected';
  return 'Pending';
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

type Tab = 'bookings' | 'confirmed' | 'records' | 'accounts';

// ─────────────────────────────────────────────────────────────────────────────
export default function PendingApprovalsScreen() {
  const { profile } = useStore();
  const role        = profile?.role ?? '';

  const isPrivileged = canManageBookings(role);
  const isOwner      = role === 'owner' || role === 'admin';
  const isStaff      = role === 'staff';

  const [activeTab, setActiveTab]               = useState<Tab>('bookings');
  const [pendingReqs, setPendingReqs]           = useState<BookingRequest[]>([]);
  const [allReqs, setAllReqs]                   = useState<BookingRequest[]>([]);
  const [confirmedBookings, setConfirmedBookings] = useState<BookingSlot[]>([]);
  const [accountReqs, setAccountReqs]           = useState<any[]>([]);
  const [loading, setLoading]                   = useState(true);

  const [selected, setSelected]                 = useState<BookingRequest | null>(null);
  const [finalAmount, setFinalAmount]           = useState('');
  const [approving, setApproving]               = useState(false);
  const [rejecting, setRejecting]               = useState(false);
  const [fullscreenImg, setFullscreenImg]       = useState<string | null>(null);

  const [selectedBooking, setSelectedBooking]   = useState<BookingSlot | null>(null);
  const [editSlotModal, setEditSlotModal]       = useState(false);
  const [newStartH, setNewStartH]               = useState('');
  const [newStartM, setNewStartM]               = useState('');
  const [newStartPeriod, setNewStartPeriod]     = useState<'AM' | 'PM'>('AM');
  const [newEndH, setNewEndH]                   = useState('');
  const [newEndM, setNewEndM]                   = useState('');
  const [newEndPeriod, setNewEndPeriod]         = useState<'AM' | 'PM'>('PM');
  const [editReason, setEditReason]             = useState('');
  const [savingEdit, setSavingEdit]             = useState(false);

  const todayISO = new Date().toISOString().slice(0, 10);

  // ── Load ──────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!isPrivileged) return;
    setLoading(true);
    const promises: Promise<any>[] = [
      fetchPendingRequests(),
      fetchAllRequests(60),
      fetchBookingsForDate({ date: todayISO, turf: 'Turf A' }),
    ];
    if (isOwner) promises.push(fetchAccountRequests());
    const [pendingRes, allRes, confirmedRes, accountRes] = await Promise.all(promises);
    setPendingReqs(pendingRes.requests);
    setAllReqs(allRes.requests);
    setConfirmedBookings(confirmedRes.bookings);
    if (isOwner && accountRes) setAccountReqs(accountRes.requests ?? []);
    setLoading(false);
  }, [isPrivileged, isOwner, todayISO]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Approve booking ───────────────────────────────────────────────────────────
  const handleApproveBooking = async () => {
    if (!selected || !profile?.id || !isPrivileged) return;
    const amount = parseFloat(finalAmount);
    if (isNaN(amount) || amount < 0) { Alert.alert('Invalid Amount', 'Enter a valid final amount.'); return; }
    Alert.alert('Confirm Approval', `Approve ${selected.customer_name}'s booking?\nFinal Amount: ₹${amount}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        setApproving(true);
        const { error } = await approveBookingRequest({ request: selected, reviewerId: profile.id, reviewerRole: role, finalAmount: amount });
        setApproving(false);
        if (error) { Alert.alert('Error', error); return; }
        setSelected(null);
        Alert.alert('✓ Approved', `${selected.customer_name}'s booking is confirmed.`);
        await load();
      }},
    ]);
  };

  // ── Reject booking ────────────────────────────────────────────────────────────
  const handleRejectBooking = async () => {
    if (!selected || !profile?.id || !isPrivileged) return;
    Alert.alert('Reject Request', `Reject ${selected.customer_name}'s request?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        setRejecting(true);
        const { error } = await rejectBookingRequest({ requestId: selected.id, reviewerId: profile.id, reviewerRole: role });
        setRejecting(false);
        if (error) { Alert.alert('Error', error); return; }
        setSelected(null);
        await load();
      }},
    ]);
  };

  // ── Cancel confirmed booking ──────────────────────────────────────────────────
  const handleCancelBooking = (booking: BookingSlot) => {
    if (!isPrivileged || !profile?.id) return;
    Alert.alert('Cancel Booking', `Cancel ${booking.customer}'s booking (${booking.slot})?\n\nThis slot will become available again. The record is kept.`, [
      { text: 'Keep Booking', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: async () => {
        const { error } = await cancelBooking(booking.id, { changedBy: profile.id, changedByRole: role, oldSlot: booking.slot, reason: `Cancelled by ${role}` });
        if (error) { Alert.alert('Error', error); return; }
        setSelectedBooking(null);
        Alert.alert('✓ Cancelled', 'Booking cancelled. Slot is now available.');
        await load();
      }},
    ]);
  };

  // ── Open time edit ────────────────────────────────────────────────────────────
  const openEditTime = (booking: BookingSlot) => {
    setSelectedBooking(booking);
    const parts = booking.slot.split('–');
    if (parts.length === 2) {
      const sm = parts[0].trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (sm) { setNewStartH(sm[1]); setNewStartM(sm[2]); setNewStartPeriod(sm[3].toUpperCase() as 'AM' | 'PM'); }
      const em = parts[1].trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (em) { setNewEndH(em[1]); setNewEndM(em[2]); setNewEndPeriod(em[3].toUpperCase() as 'AM' | 'PM'); }
    }
    setEditReason('');
    setEditSlotModal(true);
  };

  // ── Save time edit ────────────────────────────────────────────────────────────
  const handleSaveTimeEdit = async () => {
    if (!selectedBooking || !profile?.id || !isPrivileged) return;
    const sh = parseInt(newStartH, 10); const sm = parseInt(newStartM, 10);
    const eh = parseInt(newEndH, 10);   const em = parseInt(newEndM, 10);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) { Alert.alert('Invalid Time', 'Please enter valid time values.'); return; }
    const to24 = (h: number, p: 'AM' | 'PM') => p === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
    if (to24(eh, newEndPeriod) * 60 + em <= to24(sh, newStartPeriod) * 60 + sm) {
      Alert.alert('Invalid Time', 'End time must be after start time.'); return;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const newSlot = `${pad(sh)}:${pad(sm)} ${newStartPeriod}–${pad(eh)}:${pad(em)} ${newEndPeriod}`;
    setSavingEdit(true);
    const result = await editBookingTime({
      bookingId: selectedBooking.id, newSlot, bookingDate: selectedBooking.booking_date,
      turf: selectedBooking.turf, changedBy: profile.id, changedByRole: role,
      oldSlot: selectedBooking.slot, reason: editReason.trim() || `Time edited by ${role}`,
    });
    setSavingEdit(false);
    if (result.error === 'CONFLICT') { Alert.alert('Slot Conflict', result.conflictMessage ?? 'Slot already booked.'); return; }
    if (result.error) { Alert.alert('Error', result.error); return; }
    setEditSlotModal(false); setSelectedBooking(null);
    Alert.alert('✓ Updated', 'Booking time updated successfully.');
    await load();
  };

  // ── Account handlers ──────────────────────────────────────────────────────────
  const handleApproveAccount = async (req: any) => {
    if (!profile?.id || !isOwner) return;
    Alert.alert('Approve Account', `Approve ${req.full_name} (${req.role})?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        const { error } = await approveAccountRequest(req.id, profile.id);
        if (error) { Alert.alert('Error', error); return; }
        Alert.alert('✓ Approved', `${req.full_name}'s ${req.role} account approved.`);
        await load();
      }},
    ]);
  };

  const handleRejectAccount = async (req: any) => {
    if (!profile?.id || !isOwner) return;
    Alert.alert('Reject Account', `Reject ${req.full_name}'s ${req.role} request?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        const { error } = await rejectAccountRequest(req.id, profile.id);
        if (error) { Alert.alert('Error', error); return; }
        await load();
      }},
    ]);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const renderRequestCard = (req: BookingRequest, showStatus = false) => (
    <TouchableOpacity
      key={`req-${req.id}`}
      style={[s.card, req.status === 'auto_approved' && { borderLeftColor: T.autoTxt, borderLeftWidth: 3 }]}
      onPress={() => { setSelected(req); setFinalAmount(String(req.final_amount ?? req.advance_amount)); }}
      activeOpacity={0.78}
    >
      {/* Avatar + name */}
      <View style={s.cardTop}>
        <LinearGradient
          colors={req.status === 'auto_approved' ? [T.okTxt, '#34d399'] : GRAD}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.avatar}
        >
          <Text style={s.avatarTxt}>{initials(req.customer_name)}</Text>
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.cardName}>{req.customer_name}</Text>
          <Text style={s.cardSub}>{req.phone}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          {showStatus && (
            <View style={[s.statusChip, { backgroundColor: statusBg(req.status), borderColor: statusBd(req.status) }]}>
              <Text style={[s.statusChipTxt, { color: statusColor(req.status) }]}>{statusLabel(req.status)}</Text>
            </View>
          )}
          <View style={[s.payBadge, req.payment_method !== 'cash' && s.payBadgeOnline]}>
            <Text style={[s.payBadgeTxt, req.payment_method !== 'cash' && { color: T.infoTxt }]}>
              {req.payment_method === 'cash' ? '💵 Cash' : '📲 Online'}
            </Text>
          </View>
        </View>
      </View>

      {/* Meta chips */}
      <View style={s.metaRow}>
        <MetaChip icon="📅" label={req.booking_date} />
        <MetaChip icon="🕐" label={req.slot_label} />
        <MetaChip icon="🏏" label={req.sport} />
        {req.payment_screenshot_url && <MetaChip icon="📸" label="Screenshot" tint />}
      </View>

      {req.status === 'auto_approved' && (
        <View style={s.autoBadge}>
          <Text style={s.autoBadgeTxt}>⚡ Auto-booked — Screenshot saved for reference.</Text>
        </View>
      )}

      <View style={s.tapHint}>
        <Text style={s.tapHintTxt}>Tap to review →</Text>
      </View>
    </TouchableOpacity>
  );

  const renderConfirmedCard = (b: BookingSlot) => (
    <View key={`conf-${b.id}`} style={[s.card, { borderLeftColor: T.grad0, borderLeftWidth: 3 }]}>
      <View style={s.cardTop}>
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
          <Text style={s.avatarTxt}>{initials(b.customer)}</Text>
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.cardName}>{b.customer}</Text>
          <Text style={s.cardSub}>{b.sport ?? '—'}</Text>
        </View>
        <View style={s.confirmedChip}>
          <Text style={s.confirmedChipTxt}>{b.status}</Text>
        </View>
      </View>

      <View style={s.metaRow}>
        <MetaChip icon="🕐" label={b.slot} />
        <MetaChip icon="📅" label={b.booking_date} />
        {b.phone ? <MetaChip icon="📞" label={b.phone} /> : null}
      </View>

      <View style={s.confirmedActions}>
        <TouchableOpacity style={s.editTimeBtn} onPress={() => openEditTime(b)} activeOpacity={0.8}>
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.editTimeBtnGrad}>
            <Text style={s.editTimeBtnTxt}>✎  Edit Time</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={s.cancelBookingBtn} onPress={() => handleCancelBooking(b)} activeOpacity={0.8}>
          <Text style={s.cancelBookingBtnTxt}>✕  Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const TABS = [
    { key: 'bookings',  label: 'Pending',  count: pendingReqs.length },
    { key: 'confirmed', label: "Today's",  count: confirmedBookings.length },
    { key: 'records',   label: 'Records',  count: allReqs.length },
    { key: 'accounts',  label: 'Accounts', count: accountReqs.length, hidden: !isOwner },
  ].filter((t) => !t.hidden) as { key: Tab; label: string; count: number }[];

  // ── Guard ─────────────────────────────────────────────────────────────────────
  if (!isPrivileged) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', gap: 14 }]}>
        <View style={s.lockCircle}>
          <Text style={{ fontSize: 32 }}>🔒</Text>
        </View>
        <Text style={{ fontSize: 17, color: T.text, fontWeight: '700' }}>Access restricted</Text>
        <Text style={{ fontSize: 13, color: T.text3, textAlign: 'center', paddingHorizontal: 40 }}>
          This section is for staff and owners only.
        </Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Approvals</Text>
            <Text style={s.headerSub}>Booking management</Text>
          </View>
          {!loading && pendingReqs.length > 0 && (
            <View style={s.pendingBadge}>
              <Text style={s.pendingBadgeTxt}>{pendingReqs.length} pending</Text>
            </View>
          )}
        </View>

        {/* ── Role banner ── */}
        <View style={[s.roleBanner, isStaff && s.roleBannerStaff]}>
          <View style={[s.roleDot, isStaff && s.roleDotStaff]} />
          <Text style={[s.roleBannerTxt, isStaff && s.roleBannerTxtStaff]}>
            {isStaff
              ? '🧑‍💼 Staff · Can approve, reject, view screenshots & cancel bookings'
              : '👑 Owner/Admin · Full access including account management'}
          </Text>
        </View>

        {/* ── Tab bar ── */}
        <View style={s.tabBarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tabBar}>
            {TABS.map((t) => (
              <TouchableOpacity key={t.key} style={s.tabItem} onPress={() => setActiveTab(t.key as Tab)}>
                <Text style={[s.tabTxt, activeTab === t.key && s.tabTxtActive]}>{t.label}</Text>
                {t.count > 0 && (
                  activeTab === t.key ? (
                    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.tabCountGrad}>
                      <Text style={s.tabCountGradTxt}>{t.count}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={s.tabCount}>
                      <Text style={s.tabCountTxt}>{t.count}</Text>
                    </View>
                  )
                )}
                {activeTab === t.key && (
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.tabUnderline} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Content ── */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={T.grad0} size="large" />
            <Text style={s.loadingTxt}>Loading…</Text>
          </View>

        ) : activeTab === 'bookings' ? (
          pendingReqs.length === 0 ? (
            <EmptyState icon="✅" title="All clear!" text="No pending requests right now" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
              {pendingReqs.map((req) => renderRequestCard(req, false))}
            </ScrollView>
          )

        ) : activeTab === 'confirmed' ? (
          confirmedBookings.length === 0 ? (
            <EmptyState icon="📅" title="No bookings today" text="Today's confirmed slots will appear here" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
              <View style={s.noteCard}>
                <Text style={s.noteCardTxt}>ℹ️  Both owner and staff can edit time or cancel any booking, including active ones.</Text>
              </View>
              {confirmedBookings.map((b) => renderConfirmedCard(b))}
            </ScrollView>
          )

        ) : activeTab === 'records' ? (
          allReqs.length === 0 ? (
            <EmptyState icon="📋" title="No records yet" text="All booking requests will appear here" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
              <View style={s.noteCard}>
                <Text style={s.noteCardTxt}>📋  All booking requests including auto-booked and approved records.</Text>
              </View>
              {allReqs.map((req) => renderRequestCard(req, true))}
            </ScrollView>
          )

        ) : (
          accountReqs.length === 0 ? (
            <EmptyState icon="✅" title="No pending accounts" text="New account requests will appear here" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
              {accountReqs.map((req) => (
                <View key={`areq-${req.id}`} style={s.card}>
                  <View style={s.cardTop}>
                    <LinearGradient
                      colors={req.role === 'owner' ? ['#7B2D8B', '#9C27B0'] : GRAD}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.avatar}
                    >
                      <Text style={s.avatarTxt}>{req.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.cardName}>{req.full_name}</Text>
                      <Text style={s.cardSub}>{req.email}</Text>
                    </View>
                    <View style={[s.roleBadge, req.role === 'owner' && s.roleBadgeOwner]}>
                      <Text style={s.roleBadgeTxt}>{req.role}</Text>
                    </View>
                  </View>
                  <View style={s.accountActions}>
                    <TouchableOpacity onPress={() => handleApproveAccount(req)} activeOpacity={0.85} style={{ flex: 1 }}>
                      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.approveBtn}>
                        <Text style={s.approveBtnTxt}>✓  Approve</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.rejectBtn, { flex: 1 }]} onPress={() => handleRejectAccount(req)} activeOpacity={0.8}>
                      <Text style={s.rejectBtnTxt}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )
        )}
      </SafeAreaView>

      {/* ── Booking request detail modal ── */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={s.modalSheet} showsVerticalScrollIndicator={false}>
            <View style={s.modalHandle} />
            {selected && (
              <>
                <View style={s.modalTitleRow}>
                  <Text style={s.modalTitle}>Booking Request</Text>
                  <View style={[s.statusChip, { backgroundColor: statusBg(selected.status), borderColor: statusBd(selected.status) }]}>
                    <Text style={[s.statusChipTxt, { color: statusColor(selected.status) }]}>{statusLabel(selected.status)}</Text>
                  </View>
                </View>

                {selected.status === 'auto_approved' && (
                  <View style={s.autoBanner}>
                    <Text style={s.autoBannerTxt}>⚡ Auto-confirmed. Slot already booked. Screenshot saved for reference.</Text>
                  </View>
                )}

                {[
                  { icon: '👤', label: 'Customer',  value: selected.customer_name },
                  { icon: '📞', label: 'Phone',     value: selected.phone },
                  { icon: '🏏', label: 'Sport',     value: selected.sport },
                  { icon: '📅', label: 'Date',      value: selected.booking_date },
                  { icon: '🕐', label: 'Time Slot', value: selected.slot_label },
                  { icon: '💳', label: 'Payment',   value: selected.payment_method === 'cash' ? 'Cash' : 'Online' },
                  { icon: '💰', label: 'Advance',   value: `₹${selected.advance_amount}` },
                ].map((row) => (
                  <View key={row.label} style={s.infoRow}>
                    <View style={s.infoIconWrap}>
                      <Text style={{ fontSize: 16 }}>{row.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.infoLabel}>{row.label}</Text>
                      <Text style={s.infoValue}>{row.value}</Text>
                    </View>
                  </View>
                ))}

                {selected.payment_screenshot_url && !selected.payment_screenshot_url.startsWith('rzp:') && (
                  <View style={s.ssSection}>
                    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ssSectionHdr}>
                      <Text style={s.ssSectionLbl}>📸  Payment Screenshot</Text>
                    </LinearGradient>
                    <Text style={s.ssSectionSub}>
                      {selected.status === 'auto_approved' ? 'Saved for record. Slot already confirmed.' : 'Verify payment before approving.'}
                    </Text>
                    <TouchableOpacity onPress={() => setFullscreenImg(selected.payment_screenshot_url)} activeOpacity={0.9}>
                      <Image source={{ uri: selected.payment_screenshot_url! }} style={s.ssThumb} resizeMode="cover" />
                      <View style={s.ssOverlay}>
                        <View style={s.ssOverlayPill}>
                          <Text style={s.ssOverlayTxt}>🔍  Tap to view full size</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {selected.status === 'pending' && isPrivileged && (
                  <>
                    <Text style={s.fieldLabel}>Final Amount (₹)</Text>
                    <TextInput
                      style={s.input}
                      value={finalAmount}
                      onChangeText={setFinalAmount}
                      keyboardType="numeric"
                      placeholder="Final booking amount"
                      placeholderTextColor={T.text3}
                    />
                    <TouchableOpacity onPress={handleApproveBooking} disabled={approving || rejecting}
                      style={{ opacity: approving ? 0.7 : 1 }} activeOpacity={0.88}>
                      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.approveBtnFull}>
                        {approving ? <ActivityIndicator color="#fff" /> : <Text style={s.approveBtnFullTxt}>✓  Accept &amp; Confirm Booking</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.rejectBtnFull, rejecting && { opacity: 0.7 }]}
                      onPress={handleRejectBooking} disabled={approving || rejecting}>
                      {rejecting ? <ActivityIndicator color={T.redTxt} /> : <Text style={s.rejectBtnFullTxt}>Reject Request</Text>}
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={s.closeBtnTxt}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Edit time modal ── */}
      <Modal visible={editSlotModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={s.modalSheet} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Edit Booking Time</Text>
            {selectedBooking && (
              <>
                <View style={s.currentSlotBox}>
                  <Text style={s.currentSlotLabel}>Current Slot</Text>
                  <Text style={s.currentSlot}>{selectedBooking.slot}</Text>
                </View>
                <View style={s.infoNoteBox}>
                  <Text style={s.infoNoteTxt}>ℹ️  A conflict check runs before saving. End time cannot extend into another booking.</Text>
                </View>

                <Text style={s.fieldLabel}>New Start Time</Text>
                <View style={s.timeInputRow}>
                  <TextInput style={[s.timeInput, { flex: 1 }]} value={newStartH} onChangeText={setNewStartH}
                    keyboardType="number-pad" placeholder="HH" placeholderTextColor={T.text3} maxLength={2} />
                  <Text style={s.timeSep}>:</Text>
                  <TextInput style={[s.timeInput, { flex: 1 }]} value={newStartM} onChangeText={setNewStartM}
                    keyboardType="number-pad" placeholder="MM" placeholderTextColor={T.text3} maxLength={2} />
                  {(['AM', 'PM'] as const).map((p) => (
                    <TouchableOpacity key={p} onPress={() => setNewStartPeriod(p)} activeOpacity={0.8}>
                      {newStartPeriod === p ? (
                        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.periodBtnActive}>
                          <Text style={s.periodBtnActiveTxt}>{p}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={s.periodBtn}><Text style={s.periodBtnTxt}>{p}</Text></View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.fieldLabel}>New End Time</Text>
                <View style={s.timeInputRow}>
                  <TextInput style={[s.timeInput, { flex: 1 }]} value={newEndH} onChangeText={setNewEndH}
                    keyboardType="number-pad" placeholder="HH" placeholderTextColor={T.text3} maxLength={2} />
                  <Text style={s.timeSep}>:</Text>
                  <TextInput style={[s.timeInput, { flex: 1 }]} value={newEndM} onChangeText={setNewEndM}
                    keyboardType="number-pad" placeholder="MM" placeholderTextColor={T.text3} maxLength={2} />
                  {(['AM', 'PM'] as const).map((p) => (
                    <TouchableOpacity key={p} onPress={() => setNewEndPeriod(p as 'AM' | 'PM')} activeOpacity={0.8}>
                      {newEndPeriod === p ? (
                        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.periodBtnActive}>
                          <Text style={s.periodBtnActiveTxt}>{p}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={s.periodBtn}><Text style={s.periodBtnTxt}>{p}</Text></View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.fieldLabel}>Reason (optional)</Text>
                <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                  value={editReason} onChangeText={setEditReason}
                  placeholder="e.g. Team arrived late" placeholderTextColor={T.text3} multiline />

                <TouchableOpacity onPress={handleSaveTimeEdit} disabled={savingEdit}
                  style={{ opacity: savingEdit ? 0.7 : 1 }} activeOpacity={0.88}>
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.approveBtnFull}>
                    {savingEdit ? <ActivityIndicator color="#fff" /> : <Text style={s.approveBtnFullTxt}>Save Time Change</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={() => setEditSlotModal(false)}>
                  <Text style={s.closeBtnTxt}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Fullscreen screenshot ── */}
      <Modal visible={!!fullscreenImg} transparent animationType="fade">
        <TouchableOpacity style={s.fullscreenOverlay} activeOpacity={1} onPress={() => setFullscreenImg(null)}>
          {fullscreenImg && <Image source={{ uri: fullscreenImg }} style={s.fullscreenImg} resizeMode="contain" />}
          <View style={s.fullscreenClose}>
            <Text style={s.fullscreenCloseTxt}>✕  Tap anywhere to close</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function MetaChip({ icon, label, tint }: { icon: string; label: string; tint?: boolean }) {
  return (
    <View style={[mc.chip, tint && mc.chipTint]}>
      <Text style={[mc.txt, tint && mc.txtTint]}>{icon}  {label}</Text>
    </View>
  );
}
const mc = StyleSheet.create({
  chip:     { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  chipTint: { backgroundColor: 'rgba(59,130,246,0.07)', borderColor: 'rgba(59,130,246,0.20)' },
  txt:      { fontSize: 11, color: '#7B7B8A', fontWeight: '500' },
  txtTint:  { color: '#3B82F6', fontWeight: '600' },
});

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={em.wrap}>
      <View style={em.iconWrap}><Text style={{ fontSize: 32 }}>{icon}</Text></View>
      <Text style={em.title}>{title}</Text>
      <Text style={em.text}>{text}</Text>
    </View>
  );
}
const em = StyleSheet.create({
  wrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  iconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 4, shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  title:    { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  text:     { fontSize: 13, color: '#AEAEBB' },
});

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: T.bg },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  headerSub:    { fontSize: 12, color: T.text3, marginTop: 2 },
  pendingBadge: { backgroundColor: T.redBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: T.redBd },
  pendingBadgeTxt:{ fontSize: 12, fontWeight: '800', color: T.redTxt },

  // Role banner
  roleBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: 'rgba(124,77,255,0.05)', borderBottomWidth: 1, borderBottomColor: 'rgba(124,77,255,0.10)' },
  roleBannerStaff:{ backgroundColor: T.okBg, borderBottomColor: T.okBd },
  roleDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: T.grad0 },
  roleDotStaff: { backgroundColor: T.okTxt },
  roleBannerTxt:{ fontSize: 12, fontWeight: '500', color: T.grad0, flex: 1 },
  roleBannerTxtStaff:{ color: T.okTxt },

  // Tab bar
  tabBarWrap:   { backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  tabBar:       { flexDirection: 'row', paddingHorizontal: 4, alignItems: 'stretch' },
  tabItem:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 12, position: 'relative' },
  tabTxt:       { fontSize: 13, fontWeight: '600', color: T.text3 },
  tabTxtActive: { color: T.grad0, fontWeight: '800' },
  tabCount:     { backgroundColor: T.bg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: T.border },
  tabCountTxt:  { fontSize: 10, fontWeight: '700', color: T.text3 },
  tabCountGrad: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  tabCountGradTxt:{ fontSize: 10, fontWeight: '800', color: T.white },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1 },

  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt:   { fontSize: 14, color: T.text3 },

  listContent:  { paddingTop: 10, paddingHorizontal: 14, paddingBottom: 36, gap: 10 },

  // Cards
  card:         { backgroundColor: T.surface, borderRadius: 18, borderWidth: 1, borderColor: T.border, overflow: 'hidden', shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:    { fontSize: 15, fontWeight: '800', color: T.white },
  cardName:     { fontSize: 15, fontWeight: '700', color: T.text },
  cardSub:      { fontSize: 12, color: T.text3, marginTop: 2 },

  statusChip:   { borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  statusChipTxt:{ fontSize: 11, fontWeight: '700' },
  confirmedChip:{ backgroundColor: 'rgba(124,77,255,0.09)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(124,77,255,0.22)' },
  confirmedChipTxt:{ fontSize: 11, fontWeight: '700', color: T.grad0 },
  payBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border },
  payBadgeOnline:{ backgroundColor: T.infoBg, borderColor: T.infoBd },
  payBadgeTxt:  { fontSize: 11, fontWeight: '600', color: T.text2 },

  metaRow:      { flexDirection: 'row', gap: 7, flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 12 },

  autoBadge:    { marginHorizontal: 14, marginBottom: 10, backgroundColor: T.autoBg, borderRadius: 12, padding: 9, borderWidth: 1, borderColor: T.autoBd },
  autoBadgeTxt: { fontSize: 11, color: T.autoTxt, fontWeight: '500', lineHeight: 16 },
  tapHint:      { paddingHorizontal: 14, paddingBottom: 12, alignItems: 'flex-end' },
  tapHintTxt:   { fontSize: 11, color: T.text3, fontStyle: 'italic' },

  confirmedActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  editTimeBtn:      { flex: 1 },
  editTimeBtnGrad:  { borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  editTimeBtnTxt:   { fontSize: 13, fontWeight: '700', color: T.white },
  cancelBookingBtn: { flex: 1, backgroundColor: T.redBg, borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: T.redBd },
  cancelBookingBtnTxt:{ fontSize: 13, fontWeight: '700', color: T.redTxt },

  accountActions: { flexDirection: 'row', gap: 10, padding: 14, paddingTop: 4 },
  approveBtn:     { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  approveBtnTxt:  { fontSize: 14, fontWeight: '700', color: T.white },
  rejectBtn:      { backgroundColor: T.redBg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: T.redBd },
  rejectBtnTxt:   { fontSize: 14, fontWeight: '700', color: T.redTxt },

  roleBadge:    { backgroundColor: 'rgba(124,77,255,0.09)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  roleBadgeOwner:{ backgroundColor: 'rgba(123,45,139,0.09)' },
  roleBadgeTxt: { fontSize: 12, fontWeight: '700', color: T.grad0, textTransform: 'capitalize' },

  noteCard:     { backgroundColor: T.infoBg, borderRadius: 14, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: T.infoBd },
  noteCardTxt:  { fontSize: 12, color: T.infoTxt, lineHeight: 17 },

  lockCircle:   { width: 80, height: 80, borderRadius: 40, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 52 },
  modalHandle:  { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 22 },
  modalTitleRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: T.text },
  autoBanner:   { backgroundColor: T.autoBg, borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: T.autoBd },
  autoBannerTxt:{ fontSize: 12, color: T.autoTxt, lineHeight: 18 },

  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  infoIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  infoLabel:    { fontSize: 10, fontWeight: '700', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue:    { fontSize: 15, fontWeight: '600', color: T.text, marginTop: 2 },

  ssSection:    { marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: T.grad0 },
  ssSectionHdr: { paddingHorizontal: 14, paddingVertical: 10 },
  ssSectionLbl: { fontSize: 13, fontWeight: '700', color: T.white },
  ssSectionSub: { fontSize: 11, color: T.text3, backgroundColor: 'rgba(124,77,255,0.06)', paddingHorizontal: 14, paddingVertical: 8 },
  ssThumb:      { width: '100%', height: 210 },
  ssOverlay:    { backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 12, alignItems: 'center' },
  ssOverlayPill:{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  ssOverlayTxt: { fontSize: 13, color: T.white, fontWeight: '600' },

  fieldLabel:   { fontSize: 11, fontWeight: '800', color: T.text2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  input:        { backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.text, marginBottom: 16 },
  approveBtnFull:  { borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  approveBtnFullTxt:{ fontSize: 15, fontWeight: '800', color: T.white },
  rejectBtnFull:   { backgroundColor: T.redBg, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: T.redBd },
  rejectBtnFullTxt:{ fontSize: 15, fontWeight: '700', color: T.redTxt },
  closeBtn:     { paddingVertical: 14, alignItems: 'center' },
  closeBtnTxt:  { fontSize: 14, color: T.text3, fontWeight: '600' },

  currentSlotBox:  { backgroundColor: T.bg, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: T.border },
  currentSlotLabel:{ fontSize: 10, fontWeight: '700', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  currentSlot:  { fontSize: 17, fontWeight: '700', color: T.text, fontVariant: ['tabular-nums'] },
  infoNoteBox:  { backgroundColor: T.infoBg, borderRadius: 12, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: T.infoBd },
  infoNoteTxt:  { fontSize: 12, color: T.infoTxt, lineHeight: 17 },

  timeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  timeInput:    { backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 12, fontSize: 20, fontWeight: '700', color: T.text, textAlign: 'center' },
  timeSep:      { fontSize: 22, fontWeight: '700', color: T.text2 },
  periodBtn:    { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg },
  periodBtnTxt: { fontSize: 13, fontWeight: '700', color: T.text2 },
  periodBtnActive:{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  periodBtnActiveTxt:{ fontSize: 13, fontWeight: '700', color: T.white },

  fullscreenOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullscreenImg:    { width: '100%', height: '80%' },
  fullscreenClose:  { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  fullscreenCloseTxt:{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
});
