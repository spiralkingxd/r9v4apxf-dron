import re

with open('components/profile-settings-form.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# We look for the select block and replace it with checkboxes.
pattern = r'<select\s+id="boat_role"\s+name="boat_role".*?</select>'

checkboxes = '''<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                      {["Timoneiro", "Reparo", "Ponteiro", "Suporte", "Canhoneiro", "Flex"].map((role) => {
                        const currentRoles = (initialRole || "").split(",").map(r => r.trim());
                        const isChecked = currentRoles.includes(role);
                        return (
                          <label key={role} className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center justify-center">
                              <input
                                type="checkbox"
                                name="boat_role_array"
                                value={role}
                                defaultChecked={isChecked}
                                className={"peer appearance-none w-5 h-5 border-2 rounded bg-slate-100 dark:bg-[#1a1f2e] cursor-pointer transition-all duration-200 border-slate-300 dark:border-[#2a3142] group-hover:border-blue-400 dark:group-hover:border-[#3a4152] checked:bg-cyan-500 checked:border-cyan-500 dark:checked:bg-cyan-500 dark:checked:border-cyan-500"}
                              />
                              <svg
                                className="absolute w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white transition-opacity duration-200"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                stroke="currentColor"
                                strokeWidth="1"
                              >
                                <path
                                  fillRule="evenodd"
                                  clipRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                />
                              </svg>
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-200">
                              {role}
                            </span>
                          </label>
                        );
                      })}
                    </div>'''

text = re.sub(pattern, checkboxes, text, flags=re.DOTALL)

with open('components/profile-settings-form.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('done replacing select with checkboxes')
