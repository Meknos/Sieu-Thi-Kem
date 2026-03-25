import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Create a mock client that always returns empty results
function createMockClient(): SupabaseClient {
  const mockResponse = {
    data: null,
    error: null,
    count: 0,
    status: 200,
    statusText: 'OK',
  };

  const chainable: any = new Proxy({}, {
    get: () => {
      return (..._args: any[]) => chainable;
    },
  });

  // Override terminal methods to return mock response
  chainable.then = (resolve: any) => resolve(mockResponse);
  chainable.single = () => Promise.resolve(mockResponse);
  chainable.maybeSingle = () => Promise.resolve(mockResponse);

  const mockClient = {
    from: () => chainable,
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'demo-user' } }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signIn: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  } as unknown as SupabaseClient;

  return mockClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockClient();

// Server-side client with service role (for API routes)
export function createServerClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    return createMockClient();
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
