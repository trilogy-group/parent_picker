import { getSupabaseAdmin } from "./supabase-admin";

interface AdminVerifyResult {
  isAdmin: boolean;
  userId: string | null;
  email: string | null;
}

export async function verifyAdmin(authHeader: string | null): Promise<AdminVerifyResult> {
  const fail: AdminVerifyResult = { isAdmin: false, userId: null, email: null };

  if (!authHeader?.startsWith("Bearer ")) return fail;

  const token = authHeader.slice(7);
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return fail;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return fail;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const userEmail = data.user.email?.toLowerCase() || "";
  if (!adminEmails.includes(userEmail)) return fail;

  return { isAdmin: true, userId: data.user.id, email: userEmail };
}
