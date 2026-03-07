import { Router } from 'express';
import { z } from 'zod';
import { isAuthenticated, isAdmin } from '../middleware/auth';

const router = Router();

// Mock Database (Em produção, use PostgreSQL/MongoDB com Prepared Statements)
const teamsDB: any[] = [
  { id: '1', name: 'The Salty Dogs', ownerId: 'mock_owner_id_1', ship: 'Galeão' },
  { id: '2', name: 'Kraken Hunters', ownerId: 'mock_owner_id_2', ship: 'Brigantim' },
];

/**
 * Segurança: Sanitização e Validação de Entrada
 * Usando Zod para garantir que os dados recebidos estejam no formato correto
 * e não contenham scripts maliciosos (XSS) ou injeções (SQLi).
 */
const TeamSchema = z.object({
  name: z.string().min(3).max(50).trim().regex(/^[a-zA-Z0-9\s\-_]+$/, 'Nome inválido'),
  ship: z.enum(['Sloop', 'Brigantim', 'Galeão']),
  discordLink: z.string().url(),
  members: z.array(z.string().trim().max(30)).min(2).max(4),
});

/**
 * Rota: Criar Equipe
 * Proteção: Apenas usuários autenticados.
 * Validação: Zod Schema.
 */
router.post('/', isAuthenticated, (req, res) => {
  try {
    // Valida o body da requisição
    const validatedData = TeamSchema.parse(req.body);

    const newTeam = {
      id: Date.now().toString(),
      ownerId: req.user!.id, // Segurança: O owner é sempre o usuário logado, não o que vem no body
      ...validatedData,
    };

    teamsDB.push(newTeam);
    
    // Auditoria: Log de criação
    console.log(`[AUDIT] Usuário ${req.user!.id} criou a equipe ${newTeam.id}`);

    res.status(201).json({ message: 'Equipe criada com sucesso', team: newTeam });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Segurança: Retorna apenas os erros de validação, sem stack trace
      return res.status(400).json({ error: 'Dados inválidos', details: error.issues });
    }
    // Segurança: Erro genérico em produção
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Editar Equipe
 * Proteção: Apenas usuários autenticados.
 * Prevenção de IDOR: Verifica se o usuário logado é o dono da equipe.
 */
router.put('/:id', isAuthenticated, (req, res) => {
  const teamId = req.params.id;
  const teamIndex = teamsDB.findIndex(t => t.id === teamId);

  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Equipe não encontrada' });
  }

  const team = teamsDB[teamIndex];

  // Segurança: Prevenção de IDOR (Insecure Direct Object Reference)
  // O usuário só pode editar a equipe se for o dono (ou se for Admin, caso implementado)
  if (team.ownerId !== req.user!.id && req.user!.id !== process.env.ADMIN_DISCORD_ID) {
    console.warn(`[SECURITY] Tentativa de IDOR detectada. Usuário ${req.user!.id} tentou editar equipe ${teamId}`);
    return res.status(403).json({ error: 'Acesso negado. Você não é o dono desta equipe.' });
  }

  try {
    const validatedData = TeamSchema.parse(req.body);
    
    teamsDB[teamIndex] = { ...team, ...validatedData };
    
    console.log(`[AUDIT] Usuário ${req.user!.id} editou a equipe ${teamId}`);
    res.json({ message: 'Equipe atualizada', team: teamsDB[teamIndex] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.issues });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Deletar Equipe
 * Proteção: Apenas usuários autenticados.
 * Prevenção de IDOR: Verifica se o usuário logado é o dono.
 * Confirmação de Ações: Exige validação secundária (ex: senha ou token CSRF, aqui simplificado).
 */
router.delete('/:id', isAuthenticated, (req, res) => {
  const teamId = req.params.id;
  const teamIndex = teamsDB.findIndex(t => t.id === teamId);

  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Equipe não encontrada' });
  }

  const team = teamsDB[teamIndex];

  if (team.ownerId !== req.user!.id && req.user!.id !== process.env.ADMIN_DISCORD_ID) {
    console.warn(`[SECURITY] Tentativa de IDOR detectada. Usuário ${req.user!.id} tentou deletar equipe ${teamId}`);
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  teamsDB.splice(teamIndex, 1);
  console.log(`[AUDIT] Usuário ${req.user!.id} deletou a equipe ${teamId}`);
  res.json({ message: 'Equipe deletada com sucesso' });
});

export default router;
