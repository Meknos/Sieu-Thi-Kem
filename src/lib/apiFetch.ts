/**
 * apiFetch — wrapper around fetch() that automatically injects
 * the Supabase access token AND user-id into the request headers.
 */

import { supabase } from './supabase';

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const userId = session?.user?.id;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userId) headers['x-user-id'] = userId;

  return fetch(url, { ...options, headers });
}
