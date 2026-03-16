import re

with open('app/profile/me/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'\{profile\.boat_role && profile\.boat_role !== "nenhuma" && \(\s*<span[^>]*>\s*\{profile\.boat_role\}\s*</span>\s*\)\}'

replacement = '''{profile.boat_role && profile.boat_role !== "nenhuma" && (
                  <div className="flex flex-wrap gap-2">
                    {profile.boat_role.split(',').map((r) => r.trim()).map((role) => (
                      <span key={role} className="px-3 py-1 rounded-full bg-blue-100 dark:bg-[#1a2b4b] text-blue-800 dark:text-blue-300 text-xs font-semibold capitalize border border-blue-200 dark:border-blue-800/50 shadow-sm">
                        {role}
                      </span>
                    ))}
                  </div>
                )}'''

text = re.sub(pattern, replacement, text, flags=re.DOTALL)

with open('app/profile/me/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

with open('app/profile/[id]/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(pattern, replacement, text, flags=re.DOTALL)

with open('app/profile/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('done roles split badges')
