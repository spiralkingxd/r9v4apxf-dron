import re

with open('components/profile-teams-section.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add dict to props
text = text.replace('export function ProfileTeamsSection({\n  userId,\n  userXboxGamertag,\n  teams,\n  systemMaxMembers,\n}: {\n  userId: string;\n  userXboxGamertag: string | null;\n  teams: UserTeamCard[];\n  systemMaxMembers: number;\n}) {', 'export function ProfileTeamsSection({\n  userId,\n  userXboxGamertag,\n  teams,\n  systemMaxMembers,\n  dict\n}: {\n  userId: string;\n  userXboxGamertag: string | null;\n  teams: UserTeamCard[];\n  systemMaxMembers: number;\n  dict: any;\n}) {')

# Translate hardcoded words
text = text.replace('title={reachedLimit ? "Você já participa de uma equipe" : "Fundar nova equipe"}', 'title={reachedLimit ? (dict?.teams?.teamLimitReached || "Você já participa de uma equipe") : (dict?.teams?.createTeam || "Fundar nova equipe")}')
text = text.replace('{isLaunching ? "Abrindo..." : "Fundar nova equipe"}', '{isLaunching ? "..." : (dict?.teams?.createTeam || "Fundar nova equipe")}')


with open('components/profile-teams-section.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

with open('app/profile/me/page.tsx', 'r', encoding='utf-8') as f:
    me = f.read()

me = me.replace('<ProfileTeamsSection systemMaxMembers={maxTeamSize}', '<ProfileTeamsSection dict={dict} systemMaxMembers={maxTeamSize}')

with open('app/profile/me/page.tsx', 'w', encoding='utf-8') as f:
    f.write(me)

print('done profile-teams-section translate')
