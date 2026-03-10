import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Accept both NEXT_PUBLIC_ (legacy) and VITE_ (current .env.example) prefixes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Lazy initialization: only create client when first used, not at module import time
// This allows the server to start even if env vars are missing, so we can provide
// better error messages to the user instead of just crashing the container
let _supabaseAdminClient: any = null;
let _initError: Error | null = null;

function getSupabaseAdmin() {
  // Return cached client if already initialized
  if (_supabaseAdminClient) return _supabaseAdminClient;
  
  // Throw cached init error if initialization previously failed
  if (_initError) throw _initError;

  // Validate required env vars on first use
  if (!supabaseUrl || !supabaseServiceKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL (or VITE_SUPABASE_URL)');
    if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    _initError = new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Configure them in Vercel Project Settings > Environment Variables.`
    );
    throw _initError;
  }

  // Initialize and cache the client
  _supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseAdminClient;
}

// Enhanced wrapper that handles method chaining properly
class SupabaseAdminWrapper {
  private _client: any = null;

  private getClient() {
    if (!this._client) {
      this._client = getSupabaseAdmin();
    }
    return this._client;
  }

  // Proxy all property access to the client
  [key: string]: any;
}

// Use a handler to intercept all property accesses
export const supabaseAdmin = new Proxy(new SupabaseAdminWrapper(), {
  get: (target, prop: string) => {
    try {
      const client = getSupabaseAdmin();
      const value = (client as any)[prop];
      
      // If it's a method, bind it to the client to preserve context
      if (typeof value === 'function') {
        return value.bind(client);
      }
      
      return value;
    } catch (error) {
      // Re-throw Supabase init errors up the call stack
      throw error;
    }
  },
}) as any;
