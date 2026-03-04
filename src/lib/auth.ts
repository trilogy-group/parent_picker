import { supabase, isSupabaseConfigured } from "./supabase";

export async function signInWithOtpCode(email: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error("Authentication not available in offline mode") };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
  });

  return { error: error ? new Error(error.message) : null };
}

export async function verifyOtpCode(email: string, token: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error("Authentication not available in offline mode") };
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  return { error: error ? new Error(error.message) : null };
}

export async function signOut(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: null };
  }

  const { error } = await supabase.auth.signOut();
  return { error: error ? new Error(error.message) : null };
}

export async function getSession() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error getting session:", error);
    return null;
  }
  return data.session;
}

export async function getUser() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting user:", error);
    return null;
  }
  return data.user;
}
