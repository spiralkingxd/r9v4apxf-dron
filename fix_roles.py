import re

with open('components/profile-settings-form.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the roles array mapping
text = text.replace('{["Timoneiro", "Reparo", "Ponteiro", "Suporte", "Canhoneiro", "Flex"].map(', '{["Timoneiro", "Reparo", "Suporte", "Canhoneiro"].map(')

# Adjust standard CSS classes on layout
text = text.replace('className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2"', 'className="grid grid-cols-2 gap-3 mt-2"')
text = text.replace('className="grid grid-cols-2 sm:grid-cols-3 gap-3"', 'className="grid grid-cols-2 gap-3"')

with open('components/profile-settings-form.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Roles and grid updated')
