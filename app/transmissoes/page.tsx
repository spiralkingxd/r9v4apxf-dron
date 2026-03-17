
import { Suspense } from "react";
import { Loader2, Radio, Video, Star, ExternalLink, ShieldAlert, MonitorUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTwitchStreams, getTwitchUsers } from "@/lib/twitch";

export const metadata = {
  title: "Transmissões",
  description: "Acompanhe as transmissoes ao vivo dos campeonatos e da nossa comunidade.",
};

async function getStreamersData() {
  const supabase = await createClient();
  const { data: dbStreamers, error } = await supabase
    .from("streamers")
    .select("*");

  if (error || !dbStreamers) {
    return { error: true, streamers: [] };
  }

  // Pre-process HWmalk
  const sortedStreamers = [...dbStreamers];
  const hwmalkIndex = sortedStreamers.findIndex(s => s.username.toLowerCase() === "hwmalk");
  if (hwmalkIndex > -1) {
    const [hwmalk] = sortedStreamers.splice(hwmalkIndex, 1);
    sortedStreamers.unshift(hwmalk); // Coloca em primeiro
  } else {
    // Se por acaso nao estiver no banco, forca ele aqui
    sortedStreamers.unshift({ id: "1", username: "hwmalk", is_official: true, created_at: new Date().toISOString() });
  }

  return { error: false, streamers: sortedStreamers };
}

async function StreamList() {
  const { error, streamers } = await getStreamersData();

  if (error) {
    return (
      <div className="mt-12 rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-500 max-w-lg mx-auto">
        <ShieldAlert className="mx-auto h-8 w-8 mb-2" />
        <p className="font-semibold">Erro ao carregar a lista de streamers.</p>
        <p className="text-sm mt-1">O banco de dados de streamers pode nao estar configurado.</p>
      </div>
    );
  }

  if (!streamers || streamers.length === 0) {
    return (
      <div className="mt-12 text-center py-24 bg-white/5 border border-white/10 rounded-2xl">
        <Video className="mx-auto h-12 w-12 text-slate-500 mb-4 opacity-50" />
        <h3 className="text-xl font-bold text-white mb-2">Nenhum streamer cadastrado</h3>
        <p className="text-slate-400 max-w-md mx-auto">Ainda nao temos transmissÝµes registradas. Volte em breve!</p>
      </div>
    );
  }

  const usernames = streamers.map(s => s.username);
  
  // Buscar status ao vivo
  const liveStreams = await getTwitchStreams(usernames);
  // Buscar imagens de perfil
  const twitchUsers = await getTwitchUsers(usernames);

  const isLive = (username: string) => {
    return liveStreams.find((s: {user_login: string; title: string; viewer_count: number}) => s.user_login.toLowerCase() === username.toLowerCase());
  };

  const getProfileImage = (username: string) => {
    const u = twitchUsers.find((u: {login: string; profile_image_url: string}) => u.login.toLowerCase() === username.toLowerCase());
    return u?.profile_image_url || null;
  };

  // Separa live de offline (mantendo HWmalk sempre no topo do seu respectivo grupo)
  const officialOnline: Array<{id: string, username: string, is_official: boolean, created_at: string, streamInfo: {title: string; viewer_count: number} | null, profileImage: string | null}> = [];
  const online: Array<{id: string, username: string, is_official: boolean, created_at: string, streamInfo: {title: string; viewer_count: number} | null, profileImage: string | null}> = [];
  const officialOffline: Array<{id: string, username: string, is_official: boolean, created_at: string, streamInfo: {title: string; viewer_count: number} | null, profileImage: string | null}> = [];
  const offline: Array<{id: string, username: string, is_official: boolean, created_at: string, streamInfo: {title: string; viewer_count: number} | null, profileImage: string | null}> = [];

  streamers.forEach(s => {
    const streamInfo = isLive(s.username);
    const profileImage = getProfileImage(s.username);
    const merged = { ...s, streamInfo, profileImage };

    if (streamInfo) {
      if (s.is_official) officialOnline.push(merged);
      else online.push(merged);
    } else {
      if (s.is_official) officialOffline.push(merged);
      else offline.push(merged);
    }
  });

  const mergedStreamers = [...officialOnline, ...online, ...officialOffline, ...offline];
  const hwmalkIndex = mergedStreamers.findIndex((s) => s.username.toLowerCase() === "hwmalk");

  if (hwmalkIndex > -1) {
    const [hwmalk] = mergedStreamers.splice(hwmalkIndex, 1);
    mergedStreamers.unshift(hwmalk);
  }

  const finalOrder = mergedStreamers;

  return (
    <div className="mt-8 space-y-12">
      {finalOrder.map((streamer, idx) => {
        const isOnline = !!streamer.streamInfo;
        const isHwmalk = streamer.username.toLowerCase() === "hwmalk";

        return (
          <div 
            key={streamer.id + idx} 
            className={`flex flex-col gap-4 rounded-2xl border ${isOnline ? "border-cyan-500/30 bg-cyan-950/10 shadow-[0_0_30px_rgba(6,182,212,0.1)]" : "border-white/10 bg-white/5"} overflow-hidden transition-all`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 md:p-6 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className={`h-16 w-16 overflow-hidden rounded-full border-2 ${isOnline ? "border-red-500" : "border-slate-700"}`}>
                    {streamer.profileImage ? (
                      <Image 
                        src={streamer.profileImage} 
                        alt={streamer.username} 
                        width={64} 
                        height={64} 
                        className={`h-full w-full object-cover ${!isOnline && "grayscale"}`}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-xl font-bold">
                        {streamer.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {isOnline && (
                    <span className="absolute -bottom-2 -translate-x-1/2 left-1/2 rounded border border-red-600 bg-red-500 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                      AO VIVO
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl md:text-2xl font-bold text-white shrink-0">
                      {streamer.username}
                    </h3>
                    
                    {isHwmalk ? (
                      <span className="shrink-0 flex items-center gap-1 rounded bg-gradient-to-r from-yellow-500 to-amber-600 px-2 py-0.5 text-xs font-bold text-black shadow-sm">
                        <Star className="h-3 w-3" fill="currentColor" /> Organizador
                      </span>
                    ) : streamer.is_official ? (
                      <span className="shrink-0 flex items-center gap-1 rounded bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-400 border border-blue-500/30">
                        Oficial
                      </span>
                    ) : null}
                  </div>

                  {isOnline ? (
                    <div className="mt-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-3 text-sm text-slate-300">
                      <p className="font-medium text-slate-200 line-clamp-1">{streamer.streamInfo?.title}</p>
                      <span className="hidden md:inline text-slate-600">&bull;</span>
                      <p className="flex shrink-0 items-center gap-1 text-red-400 font-semibold">
                        <Radio className="h-3.5 w-3.5" />
                        {streamer.streamInfo?.viewer_count.toLocaleString("pt-BR")} Espectadores
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">Offline no momento</p>
                  )}
                </div>
              </div>

              <div>
                <a 
                  href={`https://twitch.tv/${streamer.username}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${isOnline ? "bg-[#9146FF] text-white hover:bg-[#7c39e6]" : "bg-white/10 text-white hover:bg-white/20"}`}
                >
                  Ir para a Twitch
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Embed Viewer se estiver online */}
            {isOnline && (
              <div className="relative aspect-video w-full border-t border-white/5 bg-black">
                {/* 
                  Usando dynamic parents recomendados. Vercel app e localhost para desenvolvimento.
                  A Twitch requer que passamos o dominio do site no parametro parent.
                */}
                <iframe
                  src={`https://player.twitch.tv/?channel=${streamer.username}&parent=madnessarena.vercel.app&parent=localhost&muted=false`}
                  height="100%"
                  width="100%"
                  allowFullScreen
                  className="absolute inset-0 border-none"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function StreamsPage() {
  return (
    <main className="container mx-auto px-4 py-10 md:max-w-[1100px]">
      <div className="mb-10 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-b from-cyan-950/25 via-slate-950/40 to-slate-950/10 p-6 text-center md:p-10">
        <span className="mb-4 inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-200">
          Transmissões Ao Vivo
        </span>

        <h1 className="text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
          Transmiss<span className="text-cyan-400">oes</span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 md:text-lg">
          Acompanhe nossos campeonatos oficiais e a comunidade ao vivo na Twitch.
        </p>

        <div className="mt-7 flex justify-center">
          <Link
            href="/multiview"
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/45 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-purple-500/30 px-6 py-3 text-base font-extrabold text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.25)] transition hover:scale-[1.02] hover:from-cyan-500/30 hover:to-purple-500/40"
          >
            <MonitorUp className="h-5 w-5" />
            Abrir Multiview
          </Link>
        </div>
      </div>

      <Suspense fallback={
        <div className="py-32 flex justify-center text-cyan-400">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      }>
        <StreamList />
      </Suspense>
    </main>
  );
}
