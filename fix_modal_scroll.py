with open('components/profile-settings-form.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Make the outer container unscrollable and inner form scrollable
old_div = 'className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[rgb(11,20,33)] p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto flex flex-col"'
new_div = 'className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-2xl animate-in fade-in zoom-in-95 max-h-[95vh] flex flex-col"'

text = text.replace(old_div, new_div)

# Move the p-6 padding to children so the scrollbar is flush against the edge.
# Title header
text = text.replace('<div>\n              <h2 className="text-xl font-bold', '<div className="p-6 pb-2 shrink-0">\n              <h2 className="text-xl font-bold')

# The form
text = text.replace('<form action={formAction} className="space-y-6">', '<form action={formAction} className="space-y-6 p-6 pt-2 overflow-y-auto min-h-0 flex-1">')

with open('components/profile-settings-form.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('done')
