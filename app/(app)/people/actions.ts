"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function addPerson(data: { name: string; role?: string; area?: string; email?: string; color?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("people").insert({ owner_id: user.id, ...data });
  if (error) throw new Error(error.message);
  revalidatePath("/people");
}

export async function updatePerson(id: string, fields: { name: string; role: string | null; area: string | null; email: string | null; color: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("people").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
  revalidatePath("/tasks");
}

export async function deletePerson(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/people");
  revalidatePath("/tasks");
  redirect("/people");
}

// Owner-only: sends a real login invite and links the resulting auth account
// to this person row, so they can sign in and see their assigned tasks.
// admin.inviteUserByEmail creates the auth.users row immediately (it doesn't
// wait for the invite to be accepted), so the link happens right away.
export async function invitePerson(personId: string, email: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new Error("only the owner can send invites");

  const admin = createAdminClient();
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });
  if (inviteError) throw new Error(inviteError.message);

  const { error } = await supabase.from("people").update({ auth_user_id: invited.user.id, email }).eq("id", personId);
  if (error) throw new Error(error.message);
  revalidatePath("/people");
  revalidatePath(`/people/${personId}`);
}
