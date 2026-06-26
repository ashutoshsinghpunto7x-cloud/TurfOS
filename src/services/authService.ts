import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

export type AppRole = 'owner' | 'admin' | 'staff' | 'customer';
export interface SignInResult { profile: UserProfile; error: null; }
export interface SignInError  { profile: null; error: string; }

// ── Email normalizer ──────────────────────────────────────────────────────────
// CRITICAL: Supabase Auth stores emails lowercase. Any case mismatch between
// signup and signin = "invalid credentials" even with correct password.
// Always normalize BOTH sides.
function normalizeEmail(raw: string): string {
  return (raw ?? '').trim().toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up
// ─────────────────────────────────────────────────────────────────────────────

export async function signUpCustomer(params: {
  email:    string;
  password: string;
  fullName: string;
  role?:    AppRole;
}): Promise<{ profile: UserProfile | null; error: string | null }> {
  const email = normalizeEmail(params.email);
  const role  = params.role ?? 'customer';

  // Step 1: Create Supabase auth user
  const { data, error } = await supabase.auth.signUp({
    email,
    password: params.password, // NEVER trim password
    options: {
      data: { full_name: params.fullName.trim(), role },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('user already registered')) {
      return { profile: null, error: 'ALREADY_EXISTS' };
    }
    return { profile: null, error: error.message };
  }

  if (!data.user) {
    return { profile: null, error: 'Signup failed — no user returned. Please try again.' };
  }

  // Step 2: Upsert profile row immediately — prevents missing-profile login failures
  // Do this even before session confirmation so the row exists
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id:        data.user.id,
    email,
    full_name: params.fullName.trim(),
    role,
  });

  if (profileErr) {
    // Profile upsert failed — log but don't block (user can still log in after confirmation)
    console.warn('Profile upsert warning:', profileErr.message);
  }

  // Step 3: Check if email confirmation is required
  // When email confirmation is ON, data.session is null but data.user exists
  if (!data.session) {
    // User created but email confirmation required
    return { profile: null, error: 'CONFIRM_EMAIL' };
  }

  // Step 4: Session exists — user is logged in (email confirmation is OFF in Supabase dashboard)
  const profile = await getProfileByUserId(data.user.id);
  return { profile, error: profile ? null : 'Profile could not be created.' };
}

// ── Account request (for notification purposes only) ──────────────────────────
export async function submitAccountRequest(params: {
  fullName: string; email: string; role: 'staff' | 'owner';
}): Promise<{ error: string | null }> {
  const email = normalizeEmail(params.email);

  const { data: settings } = await supabase
    .from('owner_settings').select('allow_staff_requests').limit(1).single();
  if (settings && (settings as any).allow_staff_requests === false) {
    return { error: 'New staff/owner registrations are currently disabled.' };
  }

  const { data: existing } = await supabase
    .from('account_requests').select('id, status').eq('email', email).limit(1).single();
  if (existing) {
    if ((existing as any).status === 'pending')  return { error: 'A request for this email is already pending.' };
    if ((existing as any).status === 'approved') return { error: 'This email is already approved. Please sign in.' };
  }

  const { error } = await supabase.from('account_requests').insert({
    full_name: params.fullName.trim(), email, role: params.role, status: 'pending',
  });
  return { error: error?.message ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign In — definitive fix
// ─────────────────────────────────────────────────────────────────────────────

export async function signInWithEmail(
  rawEmail: string,
  password: string,
): Promise<SignInResult | SignInError> {
  const email = normalizeEmail(rawEmail);
  if (!email)    return { profile: null, error: 'Please enter your email address.' };
  if (!password) return { profile: null, error: 'Please enter your password.' };

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
    // IMPORTANT: Do NOT trim/modify the password string in any way
  });

  if (authError || !authData.session) {
    const msg = (authError?.message ?? '').toLowerCase();

    // ── DEFINITIVE ROOT CAUSE FIX ───────────────────────────────────────────
    // Supabase returns "Invalid login credentials" for MULTIPLE scenarios:
    //   1. Wrong password (truly invalid)
    //   2. Email not confirmed (user exists but hasn't clicked email link)
    //   3. User doesn't exist at all
    //
    // We cannot distinguish these from the error message alone.
    // We use a secondary check to give accurate feedback.
    // ────────────────────────────────────────────────────────────────────────

    if (
      msg.includes('invalid login') ||
      msg.includes('invalid credentials') ||
      msg.includes('invalid email or password') ||
      msg.includes('email not confirmed') ||
      msg.includes('email_not_confirmed')
    ) {
      // Check if a profile exists (means user signed up and profile was created)
      const { data: profileCheck } = await supabase
        .from('profiles').select('id, role').eq('email', email).maybeSingle();

      if (profileCheck) {
        // Profile exists → user signed up → most likely email not confirmed
        // OR truly wrong password. Give them both options.
        if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
          return {
            profile: null,
            error: 'Your email address has not been confirmed yet.\n\nPlease check your inbox and click the confirmation link, then try signing in again.\n\nIf you cannot find the email, try signing up again with the same address to resend it.',
          };
        }
        return {
          profile: null,
          error: 'Incorrect password.\n\nIf you just signed up, please check your email and confirm your account first.\n\nNote: Passwords are case-sensitive.',
        };
      }

      // No profile found — check account_requests to give a better message
      const { data: reqCheck } = await supabase
        .from('account_requests').select('status, role').eq('email', email).maybeSingle();

      if (reqCheck) {
        const reqStatus = (reqCheck as any).status;
        const reqRole   = (reqCheck as any).role;
        if (reqStatus === 'pending') {
          return {
            profile: null,
            error: `Your ${reqRole} request is pending approval.\n\nTo log in, you also need to complete your signup:\n1. Tap "Create Account"\n2. Sign up with this same email\n3. Confirm your email\n4. Then sign in`,
          };
        }
        if (reqStatus === 'approved') {
          return {
            profile: null,
            error: `Your ${reqRole} request was approved, but you haven't completed your signup yet.\n\nPlease tap "Create Account" and sign up with this email address.`,
          };
        }
      }

      // No profile, no request → user truly doesn't exist
      return {
        profile: null,
        error: 'No account found with this email address.\n\nPlease tap "Create Account" to sign up first.',
      };
    }

    if (msg.includes('too many') || msg.includes('rate limit')) {
      return { profile: null, error: 'Too many login attempts. Please wait a few minutes and try again.' };
    }

    return { profile: null, error: authError?.message ?? 'Sign-in failed. Please try again.' };
  }

  const userId = authData.session.user.id;

  // Profile recovery — if profile row missing (can happen in edge cases), recover from JWT
  let profile = await getProfileByUserId(userId);

  if (!profile) {
    const meta    = authData.session.user.user_metadata ?? {};
    const appMeta = authData.session.user.app_metadata  ?? {};
    const fullName = (meta.full_name ?? meta.name ?? email.split('@')[0]).trim();
    const role: AppRole = (meta.role ?? appMeta.role ?? 'customer') as AppRole;

    await supabase.from('profiles').upsert({
      id: userId, email, full_name: fullName, role,
    });
    profile = await getProfileByUserId(userId);
  }

  if (!profile) {
    await supabase.auth.signOut();
    return {
      profile: null,
      error: 'Account profile not found. Please contact the turf owner or try signing up again.',
    };
  }

  return { profile, error: null };
}

// ── Session restore ────────────────────────────────────────────────────────────

export async function getExistingSession(): Promise<{
  profile: UserProfile | null; profileMissing: boolean;
}> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { profile: null, profileMissing: false };

  const userId = data.session.user.id;
  let profile  = await getProfileByUserId(userId);

  if (!profile) {
    const meta    = data.session.user.user_metadata ?? {};
    const appMeta = data.session.user.app_metadata  ?? {};
    const fullName = (meta.full_name ?? meta.name ?? data.session.user.email?.split('@')[0] ?? 'User').trim();
    const role: AppRole = (meta.role ?? appMeta.role ?? 'customer') as AppRole;

    await supabase.from('profiles').upsert({
      id:        userId,
      email:     normalizeEmail(data.session.user.email ?? ''),
      full_name: fullName,
      role,
    });
    profile = await getProfileByUserId(userId);
  }

  if (!profile) return { profile: null, profileMissing: true };
  return { profile, profileMissing: false };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export async function getProfileByUserId(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles').select('id, full_name, email, role').eq('id', userId).single();
  if (error || !data) return null;
  return { id: data.id, full_name: data.full_name ?? '', role: data.role };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function sendPasswordResetEmail(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email));
  return { error: error?.message ?? null };
}

export async function saveUserRole(userId: string, role: AppRole): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  return { error: error?.message ?? null };
}

export async function promoteUserRole(params: {
  targetUserId: string; newRole: AppRole; promotedBy: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles').update({ role: params.newRole }).eq('id', params.targetUserId);
  return { error: error?.message ?? null };
}

export async function fetchAccountRequests(): Promise<{ requests: any[]; error: string | null }> {
  const { data, error } = await supabase
    .from('account_requests').select('*').eq('status', 'pending').order('created_at');
  if (error) return { requests: [], error: error.message };
  return { requests: data ?? [], error: null };
}

export async function approveAccountRequest(requestId: string, reviewerId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('account_requests').update({
    status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(),
  }).eq('id', requestId);
  return { error: error?.message ?? null };
}

export async function rejectAccountRequest(requestId: string, reviewerId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('account_requests').update({
    status: 'rejected', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(),
  }).eq('id', requestId);
  return { error: error?.message ?? null };
}