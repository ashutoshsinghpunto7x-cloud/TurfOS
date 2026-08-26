import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Alert, TextInput,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store/useStore';
import { getClampedWindowWidth } from '../components/WebFrame';
import { fetchCustomerPhone, upsertCustomerPhone } from '../services/bookingRequestService';
import {
  fetchOpenPosts, fetchMyPosts, createPost, closePost, deletePost,
  sendInterest, fetchInterests, fetchMyInterest,
  FindPlayersPost, PostInterest, PostType, PaymentType,
  PAYMENT_LABELS, PAYMENT_HINTS,
} from '../services/findPlayersService';

const SW = getClampedWindowWidth();

const T = {
  bg:       '#F2F1FF',
  surface:  '#FFFFFF',
  border:   'rgba(0,0,0,0.055)',
  grad0:    '#7C4DFF',
  grad1:    '#8B5CF6',
  grad2:    '#60A5FA',
  orange:   '#F97316',
  orangeSf: 'rgba(249,115,22,0.11)',
  orangeBd: 'rgba(249,115,22,0.22)',
  pinkOr:   '#EC4899',
  text:     '#1A1A1A',
  text2:    '#7B7B8A',
  text3:    '#AEAEBB',
  white:    '#FFFFFF',
  green:    '#10B981',
  greenBg:  'rgba(16,185,129,0.10)',
  greenBd:  'rgba(16,185,129,0.22)',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

const SPORTS = ['Football', 'Cricket', 'Badminton', 'Box Cricket', 'Pickleball', 'Other'];

function fmtDate(iso: string | null): string {
  if (!iso) return 'Date flexible';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return iso; }
}

export default function FindPlayersScreen() {
  const navigation = useNavigation<any>();
  const { profile } = useStore();
  const insets = useSafeAreaInsets();

  const [tab, setTab]           = useState<'browse' | 'mine'>('browse');
  const [loading, setLoading]   = useState(true);
  const [posts, setPosts]       = useState<FindPlayersPost[]>([]);
  const [myPosts, setMyPosts]   = useState<FindPlayersPost[]>([]);
  const [filter, setFilter]     = useState<'all' | PostType>('all');

  const [createOpen, setCreateOpen]   = useState(false);
  const [contactPost, setContactPost] = useState<FindPlayersPost | null>(null);
  const [manageOpen, setManageOpen]   = useState<FindPlayersPost | null>(null);
  const [interests, setInterests]     = useState<PostInterest[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ posts: p }, mine] = await Promise.all([
        fetchOpenPosts(),
        profile?.id ? fetchMyPosts(profile.id) : Promise.resolve({ posts: [] as FindPlayersPost[] }),
      ]);
      setPosts(p);
      setMyPosts(mine.posts);
    } catch (err) {
      console.error('FindPlayersScreen load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visiblePosts = posts.filter((p) => filter === 'all' || p.post_type === filter);

  const openManage = async (post: FindPlayersPost) => {
    setManageOpen(post);
    setLoadingInterests(true);
    try {
      const { interests: i } = await fetchInterests(post.id);
      setInterests(i);
    } catch (err) {
      console.error('openManage failed:', err);
    } finally {
      setLoadingInterests(false);
    }
  };

  const handleClose = async (post: FindPlayersPost) => {
    Alert.alert('Close Post', 'Mark this post as closed? It will no longer be visible to others.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close Post', style: 'destructive', onPress: async () => {
        await closePost(post.id);
        setManageOpen(null);
        load();
      }},
    ]);
  };

  const handleDelete = async (post: FindPlayersPost) => {
    Alert.alert('Delete Post', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deletePost(post.id);
        setManageOpen(null);
        load();
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={T.grad0} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8, paddingBottom: 40 + insets.bottom }]}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={s.backTxt}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Find Players</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tabBtn, tab === 'browse' && s.tabBtnActive]} onPress={() => setTab('browse')}>
            <Text style={[s.tabTxt, tab === 'browse' && s.tabTxtActive]}>Browse</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, tab === 'mine' && s.tabBtnActive]} onPress={() => setTab('mine')}>
            <Text style={[s.tabTxt, tab === 'mine' && s.tabTxtActive]}>My Posts{myPosts.length ? ` (${myPosts.length})` : ''}</Text>
          </TouchableOpacity>
        </View>

        {/* New post CTA */}
        <TouchableOpacity onPress={() => setCreateOpen(true)} activeOpacity={0.88}>
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.newPostBtn}>
            <Text style={s.newPostIcon}>＋</Text>
            <Text style={s.newPostTxt}>Post — Find Players or a Team to Play</Text>
          </LinearGradient>
        </TouchableOpacity>

        {tab === 'browse' ? (
          <>
            {/* Filter chips */}
            <View style={s.chipRow}>
              {(['all', 'player', 'team'] as const).map((f) => (
                <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
                  <Text style={[s.chipTxt, filter === f && s.chipTxtActive]}>
                    {f === 'all' ? 'All' : f === 'player' ? '👤 Need Players' : '🆚 Team vs Team'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {visiblePosts.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={{ fontSize: 36 }}>🔍</Text>
                <Text style={s.emptyTxt}>No open posts yet — be the first to post!</Text>
              </View>
            ) : visiblePosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                isMine={p.creator_id === profile?.id}
                onContact={() => setContactPost(p)}
                onManage={() => openManage(p)}
              />
            ))}
          </>
        ) : (
          <>
            {myPosts.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={{ fontSize: 36 }}>📝</Text>
                <Text style={s.emptyTxt}>You haven't posted anything yet</Text>
              </View>
            ) : myPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                isMine
                closed={p.status === 'closed'}
                onContact={() => {}}
                onManage={() => openManage(p)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <CreatePostModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); }}
        profileId={profile?.id ?? null}
        profileName={profile?.full_name ?? 'Player'}
      />

      <ContactModal
        post={contactPost}
        onClose={() => setContactPost(null)}
        profileId={profile?.id ?? null}
        profileName={profile?.full_name ?? 'Player'}
      />

      <ManagePostModal
        post={manageOpen}
        interests={interests}
        loading={loadingInterests}
        onClose={() => setManageOpen(null)}
        onClosePost={handleClose}
        onDeletePost={handleDelete}
      />
    </View>
  );
}

// ── Post card ────────────────────────────────────────────────────────────────
function PostCard({ post, isMine, closed, onContact, onManage }: {
  post: FindPlayersPost; isMine: boolean; closed?: boolean;
  onContact: () => void; onManage: () => void;
}) {
  const isTeam = post.post_type === 'team';
  return (
    <View style={[cs.card, closed && { opacity: 0.55 }]}>
      <View style={cs.topRow}>
        <View style={[cs.typeBadge, isTeam ? cs.typeBadgeTeam : cs.typeBadgePlayer]}>
          <Text style={cs.typeBadgeTxt}>{isTeam ? '🆚 Team vs Team' : '👤 Need Players'}</Text>
        </View>
        {closed && <View style={cs.closedBadge}><Text style={cs.closedBadgeTxt}>Closed</Text></View>}
      </View>

      <Text style={cs.title}>{post.title}</Text>
      {post.description ? <Text style={cs.desc}>{post.description}</Text> : null}

      <View style={cs.metaRow}>
        <Text style={cs.metaIcon}>⚽</Text>
        <Text style={cs.metaTxt}>{post.sport}</Text>
      </View>
      <View style={cs.metaRow}>
        <Text style={cs.metaIcon}>📅</Text>
        <Text style={cs.metaTxt}>{fmtDate(post.match_date)}{post.match_time ? ` · ${post.match_time}` : ''}</Text>
      </View>
      {post.turf_name ? (
        <View style={cs.metaRow}>
          <Text style={cs.metaIcon}>📍</Text>
          <Text style={cs.metaTxt}>{post.turf_name}</Text>
        </View>
      ) : null}
      {!isTeam && post.players_needed ? (
        <View style={cs.metaRow}>
          <Text style={cs.metaIcon}>👥</Text>
          <Text style={cs.metaTxt}>{post.players_needed} player{post.players_needed > 1 ? 's' : ''} needed</Text>
        </View>
      ) : null}

      <View style={cs.payPill}>
        <Text style={cs.payPillTxt}>💰 {PAYMENT_LABELS[post.payment_type]}</Text>
      </View>

      <View style={cs.footer}>
        <Text style={cs.byTxt}>by {post.creator_name}</Text>
        {isMine ? (
          <TouchableOpacity style={cs.manageBtn} onPress={onManage} activeOpacity={0.85}>
            <Text style={cs.manageBtnTxt}>
              {post.interest_count !== undefined ? `${post.interest_count} interested · ` : ''}Manage
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onContact} activeOpacity={0.85}>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cs.contactBtn}>
              <Text style={cs.contactBtnTxt}>Contact</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Create post modal ────────────────────────────────────────────────────────
function CreatePostModal({ visible, onClose, onCreated, profileId, profileName }: {
  visible: boolean; onClose: () => void; onCreated: () => void;
  profileId: string | null; profileName: string;
}) {
  const [postType, setPostType]     = useState<PostType>('player');
  const [sport, setSport]           = useState(SPORTS[0]);
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [turfName, setTurfName]     = useState('');
  const [matchDate, setMatchDate]   = useState('');
  const [matchTime, setMatchTime]   = useState('');
  const [playersNeeded, setPlayersNeeded] = useState('2');
  const [paymentType, setPaymentType] = useState<PaymentType>('discuss');
  const [phone, setPhone]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (visible && profileId) {
      fetchCustomerPhone(profileId).then((p) => { if (p) setPhone(p); }).catch(() => {});
    }
    if (!visible) {
      setPostType('player'); setSport(SPORTS[0]); setTitle(''); setDesc('');
      setTurfName(''); setMatchDate(''); setMatchTime(''); setPlayersNeeded('2');
      setPaymentType('discuss'); setSubmitting(false);
    }
  }, [visible, profileId]);

  const submit = async () => {
    if (submitting) return; // guard against double-tap re-entry
    if (!profileId) { Alert.alert('Error', 'You must be signed in.'); return; }
    if (!title.trim()) { Alert.alert('Required', 'Give your post a short title.'); return; }
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { Alert.alert('Required', 'Enter a valid 10-digit contact number.'); return; }

    setSubmitting(true);
    try {
      await upsertCustomerPhone(profileId, phone.trim());
      const { error } = await createPost({
        creatorId: profileId,
        creatorName: profileName,
        creatorPhone: phone.trim(),
        postType,
        sport,
        title: title.trim(),
        description: description.trim() || null,
        turfName: turfName.trim() || null,
        matchDate: matchDate.trim() || null,
        matchTime: matchTime.trim() || null,
        playersNeeded: postType === 'player' ? (parseInt(playersNeeded) || null) : null,
        paymentType,
      });
      if (error) { Alert.alert('Error', error); return; }
      onCreated();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={m.overlay}>
        <View style={[m.sheet, { maxHeight: '90%' }]}>
          <View style={m.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={m.modalTitle}>New Post</Text>
            <Text style={m.modalSub}>Tell nearby players what you're looking for</Text>

            {/* Post type */}
            <Text style={f.label}>I'm looking for…</Text>
            <View style={f.segRow}>
              <TouchableOpacity style={[f.segBtn, postType === 'player' && f.segBtnActive]} onPress={() => setPostType('player')}>
                <Text style={[f.segTxt, postType === 'player' && f.segTxtActive]}>👤 Players to join</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[f.segBtn, postType === 'team' && f.segBtnActive]} onPress={() => setPostType('team')}>
                <Text style={[f.segTxt, postType === 'team' && f.segTxtActive]}>🆚 An opposing team</Text>
              </TouchableOpacity>
            </View>

            {/* Sport */}
            <Text style={f.label}>Sport</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {SPORTS.map((sp) => (
                <TouchableOpacity key={sp} style={[f.pill, sport === sp && f.pillActive]} onPress={() => setSport(sp)}>
                  <Text style={[f.pillTxt, sport === sp && f.pillTxtActive]}>{sp}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Title */}
            <Text style={f.label}>Title</Text>
            <TextInput
              style={f.input} value={title} onChangeText={setTitle}
              placeholder={postType === 'player' ? 'e.g. Need 3 more for 7-a-side tonight' : 'e.g. Looking for a team to play Sunday'}
              placeholderTextColor={T.text3}
            />

            {/* Description */}
            <Text style={f.label}>Details (optional)</Text>
            <TextInput
              style={[f.input, { height: 74, textAlignVertical: 'top' }]} value={description} onChangeText={setDesc}
              placeholder="Skill level, format, anything players should know" placeholderTextColor={T.text3}
              multiline
            />

            {/* Turf / location */}
            <Text style={f.label}>Turf / Location</Text>
            <TextInput
              style={f.input} value={turfName} onChangeText={setTurfName}
              placeholder="e.g. Playbox Turf A" placeholderTextColor={T.text3}
            />

            {/* Date / time */}
            <View style={f.row2}>
              <View style={{ flex: 1 }}>
                <Text style={f.label}>Date</Text>
                <TextInput
                  style={f.input} value={matchDate} onChangeText={setMatchDate}
                  placeholder="YYYY-MM-DD" placeholderTextColor={T.text3}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={f.label}>Time</Text>
                <TextInput
                  style={f.input} value={matchTime} onChangeText={setMatchTime}
                  placeholder="e.g. 7:00 PM" placeholderTextColor={T.text3}
                />
              </View>
            </View>

            {/* Players needed */}
            {postType === 'player' && (
              <>
                <Text style={f.label}>Players Needed</Text>
                <TextInput
                  style={f.input} value={playersNeeded} onChangeText={setPlayersNeeded}
                  placeholder="2" placeholderTextColor={T.text3} keyboardType="number-pad"
                />
              </>
            )}

            {/* Payment terms */}
            <Text style={f.label}>Turf Payment Terms</Text>
            {(['split_50_50', 'loser_pays', 'discuss'] as PaymentType[]).map((pt) => (
              <TouchableOpacity key={pt} style={[f.payOpt, paymentType === pt && f.payOptActive]} onPress={() => setPaymentType(pt)}>
                <View style={[f.radio, paymentType === pt && f.radioActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={[f.payOptTitle, paymentType === pt && f.payOptTitleActive]}>{PAYMENT_LABELS[pt]}</Text>
                  <Text style={f.payOptHint}>{PAYMENT_HINTS[pt]}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Contact phone */}
            <Text style={f.label}>Your Contact Number</Text>
            <TextInput
              style={f.input} value={phone} onChangeText={setPhone}
              placeholder="10-digit mobile number" placeholderTextColor={T.text3}
              keyboardType="phone-pad" maxLength={10}
            />

            <TouchableOpacity onPress={submit} disabled={submitting} activeOpacity={0.88} style={{ marginTop: 18 }}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.primaryBtn}>
                {submitting ? <ActivityIndicator color={T.white} /> : <Text style={m.primaryBtnTxt}>Post</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={m.closeBtn} onPress={onClose}>
              <Text style={m.closeTxt}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Contact modal ────────────────────────────────────────────────────────────
function ContactModal({ post, onClose, profileId, profileName }: {
  post: FindPlayersPost | null; onClose: () => void;
  profileId: string | null; profileName: string;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  React.useEffect(() => {
    setMessage(''); setSent(false); setSending(false);
    if (post && profileId) {
      fetchMyInterest(post.id, profileId).then(setSent).catch(() => {});
    }
  }, [post?.id, profileId]);

  if (!post) return null;

  const call = () => post.creator_phone && Linking.openURL(`tel:${post.creator_phone}`);
  const whatsapp = () => post.creator_phone && Linking.openURL(`whatsapp://send?phone=91${post.creator_phone.replace(/\D/g, '')}&text=${encodeURIComponent(`Hi ${post.creator_name}, I saw your post "${post.title}" on TurfOS!`)}`);

  const notify = async () => {
    if (sending) return; // guard against double-tap re-entry
    if (!profileId) { Alert.alert('Error', 'You must be signed in.'); return; }
    setSending(true);
    try {
      const phone = await fetchCustomerPhone(profileId);
      const { error } = await sendInterest({
        postId: post.id, userId: profileId, userName: profileName,
        userPhone: phone, message: message.trim() || null,
      });
      if (error) { Alert.alert('Error', error); return; }
      setSent(true);
      Alert.alert('Sent!', `${post.creator_name} will see that you're interested.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!post} transparent animationType="slide">
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.modalTitle}>{post.title}</Text>
          <Text style={m.modalSub}>Posted by {post.creator_name}</Text>

          <View style={f.payOpt}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>💰</Text>
            <View style={{ flex: 1 }}>
              <Text style={f.payOptTitle}>{PAYMENT_LABELS[post.payment_type]}</Text>
              <Text style={f.payOptHint}>{PAYMENT_HINTS[post.payment_type]}</Text>
            </View>
          </View>

          {post.creator_phone ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={cm.actionBtn} onPress={call} activeOpacity={0.85}>
                <Text style={cm.actionEmoji}>📞</Text>
                <Text style={cm.actionTxt}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cm.actionBtn} onPress={whatsapp} activeOpacity={0.85}>
                <Text style={cm.actionEmoji}>💬</Text>
                <Text style={cm.actionTxt}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={{ color: T.text3, fontSize: 12, marginTop: 12 }}>No phone number shared — send interest to connect.</Text>
          )}

          <Text style={[f.label, { marginTop: 16 }]}>Or send a quick message</Text>
          <TextInput
            style={[f.input, { height: 70, textAlignVertical: 'top' }]} value={message} onChangeText={setMessage}
            placeholder="I'm in! What time should I arrive?" placeholderTextColor={T.text3} multiline
          />

          <TouchableOpacity onPress={notify} disabled={sending || sent} activeOpacity={0.88} style={{ marginTop: 14 }}>
            <LinearGradient colors={sent ? ['#10B981', '#10B981', '#10B981'] : GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.primaryBtn}>
              {sending ? <ActivityIndicator color={T.white} /> : (
                <Text style={m.primaryBtnTxt}>{sent ? '✓ Interest Sent' : "I'm Interested"}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={m.closeBtn} onPress={onClose}>
            <Text style={m.closeTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Manage post modal (owner view) ───────────────────────────────────────────
function ManagePostModal({ post, interests, loading, onClose, onClosePost, onDeletePost }: {
  post: FindPlayersPost | null; interests: PostInterest[]; loading: boolean;
  onClose: () => void; onClosePost: (p: FindPlayersPost) => void; onDeletePost: (p: FindPlayersPost) => void;
}) {
  if (!post) return null;
  const call = (phone: string | null) => phone && Linking.openURL(`tel:${phone}`);

  return (
    <Modal visible={!!post} transparent animationType="slide">
      <View style={m.overlay}>
        <View style={[m.sheet, { maxHeight: '85%' }]}>
          <View style={m.handle} />
          <Text style={m.modalTitle}>{post.title}</Text>
          <Text style={m.modalSub}>{interests.length} player{interests.length !== 1 ? 's' : ''} interested</Text>

          {loading ? (
            <ActivityIndicator color={T.grad0} style={{ marginTop: 20 }} />
          ) : interests.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={{ fontSize: 32 }}>🕒</Text>
              <Text style={{ color: T.text3, marginTop: 8 }}>No one has reached out yet</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {interests.map((i) => (
                <View key={i.id} style={cm.interestRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={cm.interestName}>{i.user_name}</Text>
                    {i.message ? <Text style={cm.interestMsg}>{i.message}</Text> : null}
                  </View>
                  {i.user_phone ? (
                    <TouchableOpacity style={cm.callBtn} onPress={() => call(i.user_phone)}>
                      <Text style={cm.callBtnTxt}>📞 Call</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}

          {post.status === 'open' && (
            <TouchableOpacity style={cm.closePostBtn} onPress={() => onClosePost(post)}>
              <Text style={cm.closePostTxt}>Mark as Closed</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={cm.deleteBtn} onPress={() => onDeletePost(post)}>
            <Text style={cm.deleteTxt}>Delete Post</Text>
          </TouchableOpacity>

          <TouchableOpacity style={m.closeBtn} onPress={onClose}>
            <Text style={m.closeTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bg },
  scroll: { paddingHorizontal: 16, gap: 14 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 24, color: T.text, fontWeight: '600', marginTop: -2 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: T.text },

  tabRow:  { flexDirection: 'row', backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 4, gap: 4 },
  tabBtn:  { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabBtnActive: { backgroundColor: T.bg },
  tabTxt:  { fontSize: 13, fontWeight: '700', color: T.text3 },
  tabTxtActive: { color: T.grad0 },

  newPostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 14 },
  newPostIcon:{ fontSize: 18, color: T.white, fontWeight: '800' },
  newPostTxt: { fontSize: 14, fontWeight: '700', color: T.white },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip:    { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  chipActive: { backgroundColor: 'rgba(124,77,255,0.10)', borderColor: 'rgba(124,77,255,0.25)' },
  chipTxt: { fontSize: 12, fontWeight: '700', color: T.text2 },
  chipTxtActive: { color: T.grad0 },

  emptyCard: { backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 32, alignItems: 'center', gap: 10 },
  emptyTxt:  { fontSize: 13, color: T.text3, textAlign: 'center' },
});

const cs = StyleSheet.create({
  card: { backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 16, gap: 6, shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignSelf: 'flex-start' },
  typeBadgePlayer: { backgroundColor: 'rgba(124,77,255,0.10)' },
  typeBadgeTeam:   { backgroundColor: T.orangeSf },
  typeBadgeTxt: { fontSize: 11, fontWeight: '700', color: T.text },
  closedBadge: { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  closedBadgeTxt: { fontSize: 11, fontWeight: '700', color: T.text3 },
  title: { fontSize: 16, fontWeight: '800', color: T.text, marginTop: 4 },
  desc:  { fontSize: 13, color: T.text2, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaIcon: { fontSize: 13 },
  metaTxt: { fontSize: 12, color: T.text2 },
  payPill: { alignSelf: 'flex-start', backgroundColor: T.greenBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: T.greenBd, marginTop: 4 },
  payPillTxt: { fontSize: 11, fontWeight: '700', color: T.green },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  byTxt: { fontSize: 11, color: T.text3 },
  contactBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 },
  contactBtnTxt: { fontSize: 13, fontWeight: '700', color: T.white },
  manageBtn: { backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: T.border },
  manageBtnTxt: { fontSize: 12, fontWeight: '700', color: T.grad0 },
});

const f = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: T.text2, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: T.bg, borderRadius: 12, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.text },
  row2: { flexDirection: 'row', gap: 10 },
  segRow: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  segBtnActive: { backgroundColor: 'rgba(124,77,255,0.10)', borderColor: T.grad0 },
  segTxt: { fontSize: 12, fontWeight: '700', color: T.text2 },
  segTxtActive: { color: T.grad0 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, marginRight: 8 },
  pillActive: { backgroundColor: T.grad0, borderColor: T.grad0 },
  pillTxt: { fontSize: 12, fontWeight: '700', color: T.text2 },
  pillTxtActive: { color: T.white },
  payOpt: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg, borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 12, marginBottom: 8 },
  payOptActive: { borderColor: T.grad0, backgroundColor: 'rgba(124,77,255,0.06)' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: T.text3, marginRight: 12 },
  radioActive: { borderColor: T.grad0, backgroundColor: T.grad0 },
  payOptTitle: { fontSize: 13, fontWeight: '700', color: T.text },
  payOptTitleActive: { color: T.grad0 },
  payOptHint: { fontSize: 11, color: T.text3, marginTop: 2 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: T.border, borderBottomWidth: 0 },
  handle: { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: T.text, marginBottom: 2 },
  modalSub: { fontSize: 12, color: T.text3, marginBottom: 8 },
  primaryBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryBtnTxt: { fontSize: 14, fontWeight: '700', color: T.white },
  closeBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  closeTxt: { fontSize: 14, color: T.text3, fontWeight: '600' },
});

const cm = StyleSheet.create({
  actionBtn: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: T.bg, borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: T.border },
  actionEmoji: { fontSize: 20 },
  actionTxt: { fontSize: 12, fontWeight: '700', color: T.text2 },
  interestRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 12, marginBottom: 8, gap: 10 },
  interestName: { fontSize: 14, fontWeight: '700', color: T.text },
  interestMsg: { fontSize: 12, color: T.text2, marginTop: 2 },
  callBtn: { backgroundColor: 'rgba(124,77,255,0.10)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  callBtnTxt: { fontSize: 12, fontWeight: '700', color: T.grad0 },
  closePostBtn: { paddingVertical: 12, alignItems: 'center', backgroundColor: T.bg, borderRadius: 14, marginTop: 14, borderWidth: 1, borderColor: T.border },
  closePostTxt: { fontSize: 13, fontWeight: '700', color: T.text2 },
  deleteBtn: { paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.07)', borderRadius: 14, marginTop: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)' },
  deleteTxt: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
});
