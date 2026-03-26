import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * getUserId — extracts user ID from API request.
 *
 * Strategy (in order):
 * 1. Authorization: Bearer <JWT>  — standard Supabase auth
 * 2. x-user-id header            — sent by apiFetch when session exists
 * 3. Service-role fallback        — for single-tenant apps where there's
 *    exactly one user; queries public.users with service role key.
 *    This allows API routes to work even without an active browser session.
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  // 1. Bearer token
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.replace('Bearer ', '').trim();
  if (bearerToken) {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await client.auth.getUser(bearerToken);
    if (!error && user) return user.id;
  }

  // 2. x-user-id header (from apiFetch)
  const xUserId = request.headers.get('x-user-id');
  if (xUserId) return xUserId;

  // 3. Service-role fallback: get the first (and only) user
  //    This makes the app work for single-tenant without requiring browser login
  if (serviceRoleKey) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await adminClient
      .from('users')
      .select('id')
      .limit(1)
      .single();
    if (data?.id) return data.id;
  }

  return null;
}

/**
 * getServerClient — Supabase admin client (bypasses RLS).
 */
export function getServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceKey);
}
