import re

with open('components/create-team-modal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add dict to props
text = text.replace('export function CreateTeamModal({\n  userId,\n  userXboxGamertag,\n  hasReachedTeamLimit,\n  systemMaxMembers,\n  onClose,\n}: {\n  userId: string;\n  userXboxGamertag: string | null;\n  hasReachedTeamLimit: boolean;\n  systemMaxMembers: number;\n  onClose: () => void;\n}) {', 'export function CreateTeamModal({\n  userId,\n  userXboxGamertag,\n  hasReachedTeamLimit,\n  systemMaxMembers,\n  onClose,\n  dict,\n}: {\n  userId: string;\n  userXboxGamertag: string | null;\n  hasReachedTeamLimit: boolean;\n  systemMaxMembers: number;\n  onClose: () => void;\n  dict?: any;\n}) {')

# Translate title
text = text.replace('Fundar Nova Equipe\n            </h2>', '{dict?.teams?.createTeam || "Fundar Nova Equipe"}\n            </h2>')

with open('components/create-team-modal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

with open('components/profile-teams-section.tsx', 'r', encoding='utf-8') as f:
    me = f.read()

me = me.replace('<CreateTeamModal userId={userId} userXboxGamertag={userXboxGamertag} hasReachedTeamLimit={reachedLimit} onClose={() => setOpen(false)} systemMaxMembers={systemMaxMembers} />', '<CreateTeamModal dict={dict} userId={userId} userXboxGamertag={userXboxGamertag} hasReachedTeamLimit={reachedLimit} onClose={() => setOpen(false)} systemMaxMembers={systemMaxMembers} />')

with open('components/profile-teams-section.tsx', 'w', encoding='utf-8') as f:
    f.write(me)

print('done create-team-modal translate')
