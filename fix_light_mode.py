import re

with open('app/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('bg-[#050b12]', 'bg-slate-50 dark:bg-[#050b12]')
text = text.replace('border-white/10', 'border-slate-200/50 dark:border-white/10')
text = text.replace('from-[#050b12]/50 via-[#050b12]/80 to-[#050b12]', 'from-slate-50/50 via-slate-50/80 to-slate-50 dark:from-[#050b12]/50 dark:via-[#050b12]/80 dark:to-[#050b12]')

text = text.replace('bg-[#050b12]/50', 'bg-white/50 dark:bg-[#050b12]/50')
text = text.replace('border-cyan-300/25', 'border-blue-300/30 dark:border-cyan-300/25')
text = text.replace('text-cyan-200/90', 'text-blue-700 dark:text-cyan-200/90')
text = text.replace('shadow-cyan-900/20', 'shadow-blue-900/10 dark:shadow-cyan-900/20')

text = text.replace('text-white sm:text-7xl lg:text-8xl drop-shadow-2xl', 'text-slate-900 dark:text-white sm:text-7xl lg:text-8xl drop-shadow-2xl')
text = text.replace('text-slate-300 sm:text-lg', 'text-slate-600 dark:text-slate-300 sm:text-lg')

text = text.replace('border-white/20 bg-white/10 backdrop-blur-md px-6 sm:px-8 py-3 sm:py-4 text-base font-semibold text-white transition hover:bg-white/20', 'border-slate-300 dark:border-white/20 bg-slate-200/50 dark:bg-white/10 backdrop-blur-md px-6 sm:px-8 py-3 sm:py-4 text-base font-semibold text-slate-800 dark:text-white transition hover:bg-slate-300/50 dark:hover:bg-white/20')

with open('app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('done light mode fix')