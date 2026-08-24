import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export type PostType    = 'player' | 'team';
export type PaymentType = 'split_50_50' | 'loser_pays' | 'discuss';
export type PostStatus  = 'open' | 'closed';

export interface FindPlayersPost {
  id:             string;
  creator_id:     string;
  creator_name:   string;
  creator_phone:  string | null;
  post_type:      PostType;
  sport:          string;
  title:          string;
  description:    string | null;
  turf_name:      string | null;
  match_date:     string | null;   // 'YYYY-MM-DD'
  match_time:     string | null;
  players_needed: number | null;
  payment_type:   PaymentType;
  status:         PostStatus;
  created_at:     string;
  // populated client-side after fetch
  interest_count?: number;
  my_interest?:    boolean;
}

export interface PostInterest {
  id:         string;
  post_id:    string;
  user_id:    string;
  user_name:  string;
  user_phone: string | null;
  message:    string | null;
  created_at: string;
}

export const PAYMENT_LABELS: Record<PaymentType, string> = {
  split_50_50: '50/50 Split',
  loser_pays:  'Loser Pays',
  discuss:     "We'll Discuss",
};

export const PAYMENT_HINTS: Record<PaymentType, string> = {
  split_50_50: 'Both sides split the turf cost equally',
  loser_pays:  'The losing team pays the full turf cost',
  discuss:     'Payment terms to be settled by chat/call',
};

// ── Posts ──────────────────────────────────────────────────────────────────

export async function fetchOpenPosts(): Promise<{ posts: FindPlayersPost[]; error: string | null }> {
  const { data, error } = await supabase
    .from('find_players_posts')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { posts: [], error: error.message };

  const posts = (data ?? []) as FindPlayersPost[];
  if (posts.length === 0) return { posts, error: null };

  const { data: interestRows } = await supabase
    .from('find_players_interests')
    .select('post_id, user_id')
    .in('post_id', posts.map((p) => p.id));

  const counts = new Map<string, number>();
  const rows = (interestRows ?? []) as { post_id: string; user_id: string }[];
  for (const r of rows) counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);

  return {
    posts: posts.map((p) => ({ ...p, interest_count: counts.get(p.id) ?? 0 })),
    error: null,
  };
}

export async function fetchMyPosts(userId: string): Promise<{ posts: FindPlayersPost[]; error: string | null }> {
  const { data, error } = await supabase
    .from('find_players_posts')
    .select('*')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false });
  if (error) return { posts: [], error: error.message };
  return { posts: (data ?? []) as FindPlayersPost[], error: null };
}

export async function createPost(params: {
  creatorId:     string;
  creatorName:   string;
  creatorPhone:  string | null;
  postType:      PostType;
  sport:         string;
  title:         string;
  description:   string | null;
  turfName:      string | null;
  matchDate:     string | null;
  matchTime:     string | null;
  playersNeeded: number | null;
  paymentType:   PaymentType;
}): Promise<{ post: FindPlayersPost | null; error: string | null }> {
  const { data, error } = await supabase
    .from('find_players_posts')
    .insert({
      creator_id:     params.creatorId,
      creator_name:   params.creatorName.trim(),
      creator_phone:  params.creatorPhone?.trim() || null,
      post_type:      params.postType,
      sport:          params.sport.trim(),
      title:          params.title.trim(),
      description:    params.description?.trim() || null,
      turf_name:      params.turfName?.trim() || null,
      match_date:     params.matchDate,
      match_time:     params.matchTime,
      players_needed: params.playersNeeded,
      payment_type:   params.paymentType,
      status:         'open',
    })
    .select().single();
  if (error || !data) return { post: null, error: error?.message ?? 'Failed to create post.' };
  return { post: data as FindPlayersPost, error: null };
}

export async function closePost(postId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('find_players_posts').update({ status: 'closed' }).eq('id', postId);
  return { error: error?.message ?? null };
}

export async function deletePost(postId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('find_players_posts').delete().eq('id', postId);
  return { error: error?.message ?? null };
}

// ── Interests (contact requests) ────────────────────────────────────────────

export async function sendInterest(params: {
  postId:    string;
  userId:    string;
  userName:  string;
  userPhone: string | null;
  message:   string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('find_players_interests')
    .upsert({
      post_id:    params.postId,
      user_id:    params.userId,
      user_name:  params.userName.trim(),
      user_phone: params.userPhone?.trim() || null,
      message:    params.message?.trim() || null,
    }, { onConflict: 'post_id,user_id' });
  return { error: error?.message ?? null };
}

export async function fetchInterests(postId: string): Promise<{ interests: PostInterest[]; error: string | null }> {
  const { data, error } = await supabase
    .from('find_players_interests')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });
  if (error) return { interests: [], error: error.message };
  return { interests: (data ?? []) as PostInterest[], error: null };
}

export async function fetchMyInterest(postId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('find_players_interests')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
