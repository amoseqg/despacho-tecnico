'use client';

import { createBrowserClient } from '@supabase/ssr';

const fallbackUrl = 'https://hxbuoqxojwpsreakmfdc.supabase.co';
const fallbackPublishableKey = 'sb_publishable_8TfOJdgLoppVWJWjpfQwkw_bzIFuRyW';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || fallbackPublishableKey;

  return createBrowserClient(url, key);
}
