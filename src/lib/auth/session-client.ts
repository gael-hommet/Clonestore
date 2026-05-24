// src/lib/auth/session-client.ts
// B31.5 — Single browser-side Supabase access point.
// Uses supabaseBrowser() (@supabase/ssr, cookie storage) so the middleware
// can read and refresh the session on every server request.
// All client pages must import from here — never from @/lib/supabase directly.

import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export function getSessionClient() {
  return supabaseBrowser();
}

export async function getCurrentAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabaseBrowser().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function onClientAuthChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): { unsubscribe: () => void } {
  const {
    data: { subscription },
  } = supabaseBrowser().auth.onAuthStateChange(callback);
  return { unsubscribe: () => subscription.unsubscribe() };
}
