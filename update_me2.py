import re

filepath = r'C:\Users\Administrator\Downloads\Madness Arena - Site\app\profile\me\page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

old_grid = """          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-slate-200 dark:sm:divide-white/5">
            <InfoCard
              icon={<AtSign className="h-4 w-4 text-cyan-400" />}
              label="Username"
            >
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                @{profile.username}
              </span>
            </InfoCard>

            <InfoCard
              icon={<Calendar className="h-4 w-4 text-cyan-400" />}
              label="Membro desde"
            >
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {memberSince}
              </span>
            </InfoCard>
          </div>"""

new_grid = """          {/* Info grid - Top Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-slate-200 dark:sm:divide-white/5 border-b border-slate-200 dark:border-white/5">
            <InfoCard icon={<AtSign className="h-4 w-4 text-cyan-400" />} label="Username">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">@{profile.username}</span>
            </InfoCard>

            <InfoCard icon={<Calendar className="h-4 w-4 text-cyan-400" />} label="Membro desde">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{memberSince}</span>
            </InfoCard>

            <InfoCard icon={<Clock className="h-4 w-4 text-cyan-400" />} label="Última atividade">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {profile.updated_at ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(profile.updated_at)) : "--"}
              </span>
            </InfoCard>
          </div>

          {/* Info grid - Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-slate-200 dark:sm:divide-white/5">
            <InfoCard icon={<Target className="h-4 w-4 text-emerald-400" />} label="Pontos de Liga">
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.rankings?.[0]?.points || 0}</span>
            </InfoCard>

            <InfoCard icon={<Trophy className="h-4 w-4 text-amber-400" />} label="Torneios Ganhos">
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.rankings?.[0]?.wins || 0}</span>
            </InfoCard>
          </div>"""

if old_grid in text:
    text = text.replace(old_grid, new_grid)
    if 'import { AtSign, Calendar } from "lucide-react";' in text:
        text = text.replace('import { AtSign, Calendar } from "lucide-react";', 'import { AtSign, Calendar, Clock, Target, Trophy } from "lucide-react";')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
    print('Updated me page!')
else:
    print('Could not find old_grid in the text. Here is the context of what exists:')
    match = re.search(r'\{/\* Info grid \*/\}.*?</InfoCard>\s*</div>', text, flags=re.DOTALL)
    if match:
        print(match.group(0))
    else:
        print('Could not find any Info grid comment.')