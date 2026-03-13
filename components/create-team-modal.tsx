"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Anchor,
  CheckCircle2,
  ImageOff,
  Loader2,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  checkTeamNameAvailable,
  createTeam,
  searchUsers,
  type CreateTeamState,
  type SearchUsersResult,
} from "@/app/teams/actions";

// ---------------------------------------------------------------------------
// Schema do formulário (lado cliente)
// ---------------------------------------------------------------------------

const schema = z.object({
  name: z
    .string()
    .min(3, "Mínimo 3 caracteres.")
    .max(30, "Máximo 30 caracteres.")
    .trim(),
  logo_url: z
    .string()
    .refine(
      (v) => v === "" || (() => { try { new URL(v); return true; } catch { return false; } })(),
      { message: "URL inválida." },
    ),
});

type FormValues = {
  name: string;
  logo_url: string;
};

type Member = SearchUsersResult[number];

const MAX_MEMBERS = 10;
const SEARCH_DEBOUNCE = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function Avatar({
  src,
  name,
  size = 32,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal principal
// ---------------------------------------------------------------------------

interface CreateTeamModalProps {
  /** Identificador do usuário autenticado passado pelo servidor (Server Component pai) */
  userId: string;
  onClose?: () => void;
}

export function CreateTeamModal({ userId, onClose }: CreateTeamModalProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form state
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", logo_url: "" },
  });

  const watchedLogoUrl = watch("logo_url");
  const watchedName = watch("name");

  // Server action state
  const [actionState, setActionState] = useState<CreateTeamState>({});
  const [isPending, startTransition] = useTransition();

  // Name availability
  const debouncedName = useDebounce(watchedName, SEARCH_DEBOUNCE);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);

  useEffect(() => {
    if (debouncedName.trim().length < 3) {
      setNameAvailable(null);
      return;
    }
    let cancelled = false;
    setCheckingName(true);
    checkTeamNameAvailable(debouncedName).then(({ available }) => {
      if (!cancelled) {
        setNameAvailable(available);
        setCheckingName(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedName]);

  // Member search
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, SEARCH_DEBOUNCE);
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (debouncedSearch.trim().length < 2) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchUsers(debouncedSearch).then((results) => {
      if (!cancelled) {
        // Exclui os já selecionados dos resultados
        const selected = new Set(selectedMembers.map((m) => m.id));
        setSearchResults(results.filter((r) => !selected.has(r.id)));
        setDropdownOpen(true);
        setSearching(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, selectedMembers]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fechar overlay ao pressionar Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Bloqueia scroll do body enquanto modal está aberto
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function addMember(member: Member) {
    if (
      selectedMembers.length >= MAX_MEMBERS - 1 ||
      selectedMembers.find((m) => m.id === member.id)
    )
      return;
    setSelectedMembers((prev) => [...prev, member]);
    setSearchResults((prev) => prev.filter((r) => r.id !== member.id));
    setSearchTerm("");
    setDropdownOpen(false);
  }

  function removeMember(id: string) {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id));
  }

  const totalMembers = selectedMembers.length + 1; // +1 = capitão

  const onSubmit = useCallback(
    (values: FormValues) => {
      const fd = new FormData();
      fd.set("name", values.name);
      if (values.logo_url) fd.set("logo_url", values.logo_url);
      for (const m of selectedMembers) fd.append("member_id", m.id);

      startTransition(async () => {
        const result = await createTeam({}, fd);
        if (result?.teamId) {
          if (result.success) {
            setToastMessage(result.success);
          }

          setTimeout(() => {
            onClose?.();
            router.push(`/teams/${result.teamId}`);
            router.refresh();
          }, 500);
          return;
        }

        if (result?.error) {
          setActionState(result);
        }
      });
    },
    [selectedMembers, router, onClose],
  );

  return (
    /* Overlay */
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose?.();
      }}
    >
      {toastMessage ? (
        <div className="pointer-events-none absolute top-6 rounded-xl border border-emerald-300/30 bg-emerald-300/15 px-4 py-2 text-sm font-medium text-emerald-100 shadow-lg">
          {toastMessage}
        </div>
      ) : null}

      {/* Painel */}
      <div className="relative flex w-full max-w-xl flex-col rounded-3xl border border-white/10 bg-[#0d1f33] shadow-2xl">
        {/* Barra dourada */}
        <div className="h-1 w-full rounded-t-3xl bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-7 pt-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            <Anchor className="h-5 w-5 text-amber-400" />
            Fundar Nova Equipe
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="overflow-y-auto px-7 pb-7 pt-5"
          style={{ maxHeight: "calc(100dvh - 80px)" }}
        >
          <div className="space-y-5">
            {/* ----- Nome da equipe ----- */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">
                Nome da equipe <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  {...register("name")}
                  disabled={isPending}
                  placeholder="Ex: Corsários do Abismo"
                  maxLength={30}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-slate-100 outline-none ring-amber-300/40 transition placeholder:text-slate-500 focus:ring disabled:opacity-50"
                />
                {/* Indicador de disponibilidade */}
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingName ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : nameAvailable === true ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : nameAvailable === false ? (
                    <X className="h-4 w-4 text-rose-400" />
                  ) : null}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                {errors.name ? (
                  <p className="text-xs text-rose-400">{errors.name.message}</p>
                ) : nameAvailable === false ? (
                  <p className="text-xs text-rose-400">Nome já está em uso.</p>
                ) : nameAvailable === true ? (
                  <p className="text-xs text-emerald-400">Nome disponível!</p>
                ) : (
                  <span />
                )}
                <span className="text-right text-xs text-slate-500">
                  {watchedName?.length ?? 0}/30
                </span>
              </div>
            </div>

            {/* ----- Logo URL ----- */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">
                URL do logo{" "}
                <span className="text-xs text-slate-500">(opcional)</span>
              </label>
              <div className="flex items-center gap-3">
                {/* Preview */}
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  <LogoPreview url={watchedLogoUrl ?? ""} />
                </span>
                <input
                  {...register("logo_url")}
                  disabled={isPending}
                  placeholder="https://exemplo.com/logo.png"
                  className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-300/40 transition placeholder:text-slate-500 focus:ring disabled:opacity-50"
                />
              </div>
              {errors.logo_url ? (
                <p className="mt-1 text-xs text-rose-400">
                  {errors.logo_url.message}
                </p>
              ) : null}
            </div>

            {/* ----- Membros ----- */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-200">
                  Membros
                </label>
                <span
                  className={`flex items-center gap-1 text-xs font-semibold ${
                    totalMembers >= MAX_MEMBERS
                      ? "text-rose-400"
                      : "text-slate-400"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  {totalMembers}/{MAX_MEMBERS}
                </span>
              </div>

              {/* Capitão — sempre mostrado */}
              <div className="mb-2 flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="text-sm text-slate-300">
                  Você &mdash;{" "}
                  <span className="text-amber-300">Capitão</span>
                </span>
              </div>

              {/* Membros selecionados */}
              {selectedMembers.length > 0 && (
                <ul className="mb-2 space-y-1.5">
                  {selectedMembers.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-4 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={m.avatar_url} name={m.display_name} />
                        <div className="leading-tight">
                          <p className="text-sm font-medium text-slate-100">
                            {m.display_name}
                          </p>
                          <p className="text-xs text-slate-500">@{m.username}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(m.id)}
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-white/8 hover:text-rose-400"
                        aria-label={`Remover ${m.display_name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Campo de busca de membros */}
              {totalMembers < MAX_MEMBERS && (
                <div ref={searchRef} className="relative">
                  <div className="flex items-center rounded-xl border border-white/10 bg-black/20 px-4 py-3 focus-within:ring focus-within:ring-amber-300/40">
                    {searching ? (
                      <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-slate-400" />
                    ) : (
                      <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() =>
                        searchResults.length > 0 && setDropdownOpen(true)
                      }
                      disabled={isPending}
                      placeholder="Buscar por nome ou @username…"
                      className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-50"
                    />
                  </div>

                  {/* Dropdown de resultados */}
                  {dropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#0d1f33] shadow-xl">
                      {searchResults.length > 0 ? (
                        <ul>
                          {searchResults.map((result) => (
                            <li key={result.id}>
                              <button
                                type="button"
                                onClick={() => addMember(result)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/6"
                              >
                                <Avatar
                                  src={result.avatar_url}
                                  name={result.display_name}
                                />
                                <div className="leading-tight">
                                  <p className="text-sm font-medium text-slate-100">
                                    {result.display_name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    @{result.username}
                                  </p>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="px-4 py-3 text-sm text-slate-400">
                          Nenhum usuário encontrado.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {totalMembers >= MAX_MEMBERS && (
                <p className="mt-2 text-xs text-slate-500">
                  Limite de {MAX_MEMBERS} membros atingido.
                </p>
              )}
            </div>

            {/* ----- Erro global ----- */}
            {actionState.error ? (
              <div className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {actionState.error}
              </div>
            ) : null}

            {/* ----- Ações ----- */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="flex-1 rounded-xl border border-white/10 bg-white/4 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/8 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || nameAvailable === false}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando…
                  </>
                ) : (
                  <>
                    <Anchor className="h-4 w-4" />
                    Fundar Equipe
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview do logo em tempo real
// ---------------------------------------------------------------------------

function LogoPreview({ url }: { url: string }) {
  const [valid, setValid] = useState(false);

  useEffect(() => {
    if (!url) {
      setValid(false);
      return;
    }
    try {
      new URL(url);
      setValid(true);
    } catch {
      setValid(false);
    }
  }, [url]);

  if (valid) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="logo preview"
        className="h-full w-full object-cover"
        onError={() => setValid(false)}
      />
    );
  }

  return <ImageOff className="h-5 w-5 text-slate-500" />;
}
