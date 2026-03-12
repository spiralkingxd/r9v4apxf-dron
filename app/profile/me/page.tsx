import { redirect } from "next/navigation";

import { updateMyProfile } from "@/app/profile/me/actions";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  discord_id: string | null;
  display_name: string;
  username: string;
  email: string | null;
  bio: string | null;
  xbox_gamertag: string | null;
  avatar_url: string | null;
  created_at: string;
};

export default async function MyProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/profile/me");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, discord_id, display_name, username, email, bio, xbox_gamertag, avatar_url, created_at")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!profile) {
    redirect("/auth/login?error=profile_not_found");
  }

  // Inline void wrapper so <form action> receives a void-returning function
  async function handleUpdate(formData: FormData): Promise<void> {
    "use server";
    await updateMyProfile(formData);
  }

  return (

    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] px-6 py-12 text-slate-100">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-2xl shadow-black/30">
        <h1 className="text-3xl font-semibold text-white">Meu Perfil</h1>
        <p className="mt-2 text-sm text-slate-300">
          Dados sincronizados do Discord e integração de Xbox no momento do login.
        </p>

        <form action={handleUpdate} className="mt-8 space-y-6">
          <ReadOnlyField label="Nome de exibição" value={profile.display_name} />
          <ReadOnlyField label="Username" value={profile.username} />
          <ReadOnlyField label="Discord ID" value={profile.discord_id ?? "-"} />
          <ReadOnlyField label="Email" value={profile.email ?? "-"} />
          <ReadOnlyField label="Xbox Gamertag" value={profile.xbox_gamertag ?? "Sem conexão Xbox no Discord"} />
          <ReadOnlyField label="Avatar URL" value={profile.avatar_url ?? "-"} />

          <div>
            <label htmlFor="bio" className="mb-2 block text-sm font-medium text-slate-200">
              Bio (editável)
            </label>
            <textarea
              id="bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              maxLength={240}
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:ring"
              placeholder="Conte um pouco sobre sua tripulação..."
            />
          </div>

          <button
            type="submit"
            className="inline-flex rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Salvar perfil
          </button>
        </form>
      </section>
    </main>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  // Inline void wrapper so <form action> receives a void-returning function
  async function handleUpdate(formData: FormData): Promise<void> {
    "use server";
    await updateMyProfile(formData);
  }

  return (

    <div>
      <p className="mb-2 text-sm font-medium text-slate-200">{label}</p>
      <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100">{value}</p>
    </div>
  );
}