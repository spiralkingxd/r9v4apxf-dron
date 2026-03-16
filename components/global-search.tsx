"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, User, Trophy, Users, MoveRight } from "lucide-react";
import { globalSearchAction, SearchResult } from "@/app/actions/search-actions";

type SearchFilter = "all" | "user" | "tournament" | "team";

export function GlobalSearch({ dict }: { dict?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<SearchFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const handleSearch = () => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length < 2) {
        setResults([]);
        return;
      }
      
      startTransition(async () => {
        const data = await globalSearchAction(trimmedQuery, filter);
        setResults(data);
      });
    };

    const debounceId = setTimeout(handleSearch, 300);
    return () => clearTimeout(debounceId);
  }, [query, filter]);

  const handleResultClick = (url: string) => {
    setIsOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(url);
  };

  const parseQueryForFilter = (text: string) => {
    if (text.startsWith("user:")) {
      setFilter("user");
      setQuery(text.replace("user:", ""));
    } else if (text.startsWith("torneio:")) {
      setFilter("tournament");
      setQuery(text.replace("torneio:", ""));
    } else if (text.startsWith("equipe:")) {
      setFilter("team");
      setQuery(text.replace("equipe:", ""));
    } else {
      setQuery(text);
    }
  };

  return (
    <div className="relative z-50 flex items-center" ref={containerRef}>
      
      {/* Mobile Icon */}
      <button 
        type="button"
        className="md:hidden flex p-2 items-center justify-center text-slate-600 dark:text-slate-400"
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Input container (absolute on mobile if open, relative on md desktop) */}
      <div className={`
        ${isOpen ? 'absolute top-full right-0 mt-2 md:mt-0 md:relative md:top-auto md:right-auto' : 'hidden'} 
        md:flex md:relative items-center transition-all duration-300 ${isOpen ? 'w-[calc(100vw-32px)] sm:w-96 md:w-80' : 'md:w-56 lg:w-64'}
      `}>
        <div className={`flex items-center w-full h-9 rounded-xl border ${isOpen ? 'border-primary bg-white dark:bg-slate-900 shadow-md ring-2 ring-primary/20' : 'border-slate-300 dark:border-white/10 bg-white/50 dark:bg-black/20 hover:bg-slate-200 dark:hover:bg-white/10'} px-2 transition-all`}>
          <Search className="h-4 w-4 text-slate-500 shrink-0 ml-1" />
          
          {filter !== "all" && (
            <span className="flex shrink-0 items-center justify-center bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ml-2">
              {filter === "user" ? "user:" : filter === "tournament" ? "torneio:" : "equipe:"}
              <button 
                onClick={(e) => { e.stopPropagation(); setFilter("all"); inputRef.current?.focus(); }}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          <input
            ref={inputRef}
            type="text"
            placeholder={
              filter === "all"
                ? (isOpen
                    ? (dict?.search?.placeholderOpen ?? "Buscar... (ex: user:)")
                    : (dict?.search?.placeholder ?? "Buscar..."))
                : ""
            }
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 px-2 w-full min-w-0"
            value={query}
            onChange={(e) => parseQueryForFilter(e.target.value)}
            onFocus={() => setIsOpen(true)}
          />

          {isPending && <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin mr-1 shrink-0" />}

          {isOpen && query.length > 0 && (
            <button onClick={() => setQuery("")} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Menu directly under the input */}
        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-full sm:w-[400px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 origin-top-right">
            
            <div className="max-h-[60vh] overflow-y-auto p-1.5">
              {query.trim().length > 0 && query.trim().length < 2 && (
                <div className="p-4 text-center text-sm text-slate-500">
                  Digite pelo menos 2 caracteres...
                </div>
              )}
              
              {query.trim().length >= 2 && results.length === 0 && !isPending && (
                <div className="p-6 text-center text-sm text-slate-500">
                  Nenhum resultado encontrado para &quot;{query}&quot;
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Resultados
                  </div>
                  {results.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result.url)}
                      className="w-full flex items-center text-left gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition group"
                    >
                      <div className="relative flex shrink-0 h-8 w-8 overflow-hidden rounded-full border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-900 justify-center items-center">
                        {result.imageUrl ? (
                          <img src={result.imageUrl} alt={result.title} className="aspect-square h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-transparent text-slate-500">
                            {result.type === "user" && <User className="h-4 w-4" />}
                            {result.type === "tournament" && <Trophy className="h-4 w-4" />}
                            {result.type === "team" && <Users className="h-4 w-4" />}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0">
                            {result.subtitle}
                          </div>
                        )}
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-1 text-slate-400">
                        <MoveRight className="h-4 w-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Suggestions / Filters (only show when empty) */}
              {query.length === 0 && filter === "all" && (
                <div className="p-2">
                  <div className="px-1 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Filtros
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button 
                      onClick={() => { setFilter("user"); inputRef.current?.focus(); }}
                      className="flex items-center gap-3 p-2 text-sm text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
                    >
                      <User className="h-4 w-4 text-slate-500" />
                      De um usuário específico 
                      <span className="ml-auto text-xs text-slate-400 font-mono">user:</span>
                    </button>
                    <button 
                      onClick={() => { setFilter("tournament"); inputRef.current?.focus(); }}
                      className="flex items-center gap-3 p-2 text-sm text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
                    >
                      <Trophy className="h-4 w-4 text-slate-500" />
                      Em um torneio
                      <span className="ml-auto text-xs text-slate-400 font-mono">torneio:</span>
                    </button>
                    <button 
                      onClick={() => { setFilter("team"); inputRef.current?.focus(); }}
                      className="flex items-center gap-3 p-2 text-sm text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
                    >
                      <Users className="h-4 w-4 text-slate-500" />
                      Buscar por equipe
                      <span className="ml-auto text-xs text-slate-400 font-mono">equipe:</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer / Tip */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-2 text-[10px] text-center text-slate-500 border-t border-slate-100 dark:border-slate-800">
              Navegue, clique sobre os filtros ou <kbd className="font-mono font-bold ml-1">ESC</kbd> para fechar
            </div>
          </div>
        )}
      </div>
    </div>
  );
}