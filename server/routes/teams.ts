import { Router } from 'express';
import { z } from 'zod';
import { isAuthenticated, isAdmin } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimit } from 'express-rate-limit';

const router = Router();

const teamCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: 'Muitas tentativas de criação de equipe. Tente novamente mais tarde.',
});

/**
 * Segurança: Sanitização e Validação de Entrada
 * Usando Zod para garantir que os dados recebidos estejam no formato correto
 * e não contenham scripts maliciosos (XSS) ou injeções (SQLi).
 */
const CreateTeamSchema = z.object({
  name: z.string().min(3).max(50).regex(/^[a-zA-Z0-9\s\-_]+$/, 'Nome inválido (apenas letras, números, espaços, - e _)').trim().transform(val => val.replace(/<[^>]*>?/gm, '')),
  ship_name: z.string().min(3).max(50).trim().transform(val => val.replace(/<[^>]*>?/gm, '')),
  gamertag: z.string().min(3).max(50).trim().transform(val => val.replace(/<[^>]*>?/gm, '')), // Gamertag do capitão
  logo_url: z.string().url().regex(/\.(jpg|jpeg|png|webp)$/i).optional().or(z.literal('')),
});

const UpdateTeamSchema = z.object({
  name: z.string().min(3).max(50).regex(/^[a-zA-Z0-9\s\-_]+$/, 'Nome inválido').trim().transform(val => val.replace(/<[^>]*>?/gm, '')).optional(),
  ship_name: z.string().min(3).max(50).trim().transform(val => val.replace(/<[^>]*>?/gm, '')).optional(),
  logo_url: z.string().url().regex(/\.(jpg|jpeg|png|webp)$/i).optional().or(z.literal('')),
});

const AddMemberSchema = z.object({
  gamertag: z.string().min(3).max(50).trim().transform(val => val.replace(/<[^>]*>?/gm, '')),
  discord_id: z.string().optional(), // Opcional se for convite por link/busca
});

/**
 * Rota: Listar Equipes (Usuário)
 * Retorna as equipes onde o usuário é membro.
 * Se for admin e passar ?all=true, retorna todas.
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const isAdminUser = req.user!.id === process.env.ADMIN_DISCORD_ID;

    if (isAdminUser && req.query.all === 'true') {
      const { data: allTeams, error: allError } = await supabaseAdmin
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (allError) throw allError;
      return res.json(allTeams);
    }

    const { data: memberships, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('team_id')
      .eq('user_id', req.user!.id);

    if (memberError) throw memberError;

    const teamIds = memberships.map(m => m.team_id);
    
    if (teamIds.length === 0) {
      return res.json([]);
    }

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('*')
      .in('id', teamIds);

    if (teamsError) throw teamsError;

    res.json(teams);
  } catch (error) {
    console.error('Erro ao listar equipes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Detalhes da Equipe
 */
router.get('/:id', isAuthenticated, async (req, res) => {
  const teamId = req.params.id;
  try {
    // Verificar se usuário é membro ou admin
    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', req.user!.id)
      .single();

    const isAdminUser = req.user!.id === process.env.ADMIN_DISCORD_ID;

    if (memberError && !isAdminUser) {
      return res.status(403).json({ error: 'Acesso negado. Você não é membro desta equipe.' });
    }

    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return res.status(404).json({ error: 'Equipe não encontrada' });
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);

    if (membersError) throw membersError;

    res.json({ ...team, members });
  } catch (error) {
    console.error('Erro ao buscar detalhes da equipe:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Criar Equipe
 * Proteção: Apenas usuários autenticados.
 * Validação: Zod Schema.
 */
router.post('/', isAuthenticated, teamCreationLimiter, async (req, res) => {
  try {
    // Valida o body da requisição
    const validatedData = CreateTeamSchema.parse(req.body);

    // Verificar se usuário já tem equipe
    const { data: existingMember, error: existingError } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('user_id', req.user!.id)
      .single();

    if (existingMember) {
      return res.status(400).json({ error: 'Você já pertence a uma equipe.' });
    }

    // Criar equipe
    const { data: newTeam, error: createError } = await supabaseAdmin
      .from('teams')
      .insert({
        name: validatedData.name,
        ship_name: validatedData.ship_name,
        logo_url: validatedData.logo_url,
        captain_id: req.user!.id,
      })
      .select()
      .single();

    if (createError) {
      if (createError.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Nome da equipe ou navio já existe.' });
      }
      throw createError;
    }

    // Adicionar capitão como membro
    const { error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        team_id: newTeam.id,
        user_id: req.user!.id,
        gamertag: validatedData.gamertag,
        role: 'captain',
        discord_id: req.user!.id, // Assumindo que user.id é o Discord ID ou mapeado
      });

    if (memberError) {
      // Rollback (delete team if member creation fails)
      await supabaseAdmin.from('teams').delete().eq('id', newTeam.id);
      throw memberError;
    }
    
    // Auditoria: Log de criação
    console.log(`[AUDIT] Usuário ${req.user!.id} criou a equipe ${newTeam.id}`);

    res.status(201).json({ message: 'Equipe criada com sucesso', team: newTeam });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.issues });
    }
    console.error('Erro ao criar equipe:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Editar Equipe
 * Proteção: Apenas usuários autenticados.
 * Prevenção de IDOR: Verifica se o usuário logado é o dono da equipe.
 */
router.put('/:id', isAuthenticated, async (req, res) => {
  const teamId = req.params.id;

  try {
    const { data: team, error: fetchError } = await supabaseAdmin
      .from('teams')
      .select('captain_id')
      .eq('id', teamId)
      .single();

    if (fetchError || !team) {
      return res.status(404).json({ error: 'Equipe não encontrada' });
    }

    const isAdminUser = req.user!.id === process.env.ADMIN_DISCORD_ID;

    // Segurança: Prevenção de IDOR
    if (team.captain_id !== req.user!.id && !isAdminUser) {
      console.warn(`[SECURITY] Tentativa de IDOR detectada. Usuário ${req.user!.id} tentou editar equipe ${teamId}`);
      return res.status(403).json({ error: 'Acesso negado. Você não é o capitão desta equipe.' });
    }

    const validatedData = UpdateTeamSchema.parse(req.body);
    
    const { data: updatedTeam, error: updateError } = await supabaseAdmin
      .from('teams')
      .update(validatedData)
      .eq('id', teamId)
      .select()
      .single();

    if (updateError) throw updateError;
    
    console.log(`[AUDIT] Usuário ${req.user!.id} editou a equipe ${teamId}`);
    res.json({ message: 'Equipe atualizada', team: updatedTeam });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.issues });
    }
    console.error('Erro ao editar equipe:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Deletar Equipe
 * Proteção: Apenas usuários autenticados.
 * Prevenção de IDOR: Verifica se o usuário logado é o dono.
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
  const teamId = req.params.id;

  try {
    const { data: team, error: fetchError } = await supabaseAdmin
      .from('teams')
      .select('captain_id')
      .eq('id', teamId)
      .single();

    if (fetchError || !team) {
      return res.status(404).json({ error: 'Equipe não encontrada' });
    }

    const isAdminUser = req.user!.id === process.env.ADMIN_DISCORD_ID;

    if (team.captain_id !== req.user!.id && !isAdminUser) {
      console.warn(`[SECURITY] Tentativa de IDOR detectada. Usuário ${req.user!.id} tentou deletar equipe ${teamId}`);
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // TODO: Verificar eventos ativos antes de deletar

    const { error: deleteError } = await supabaseAdmin
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (deleteError) throw deleteError;

    console.log(`[AUDIT] Usuário ${req.user!.id} deletou a equipe ${teamId}`);
    res.json({ message: 'Equipe deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar equipe:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Adicionar Membro (Convite simplificado para MVP)
 * Em produção, deve ser via convite (tabela team_invitations).
 * Aqui, vamos permitir adicionar direto se for capitão (para simplificar ou admin).
 */
router.post('/:id/members', isAuthenticated, async (req, res) => {
  const teamId = req.params.id;

  try {
    const { data: team, error: fetchError } = await supabaseAdmin
      .from('teams')
      .select('captain_id')
      .eq('id', teamId)
      .single();

    if (fetchError || !team) {
      return res.status(404).json({ error: 'Equipe não encontrada' });
    }

    const isAdminUser = req.user!.id === process.env.ADMIN_DISCORD_ID;

    if (team.captain_id !== req.user!.id && !isAdminUser) {
      return res.status(403).json({ error: 'Apenas o capitão pode adicionar membros.' });
    }

    const validatedData = AddMemberSchema.parse(req.body);

    // Verificar limite de membros (já tem trigger no banco, mas bom checar antes)
    const { count, error: countError } = await supabaseAdmin
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (countError) throw countError;
    if (count !== null && count >= 4) {
      return res.status(400).json({ error: 'A equipe já está cheia (máx 4 membros).' });
    }

    // Verificar se gamertag já existe na equipe
    const { data: existingGamertag } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('gamertag', validatedData.gamertag)
      .single();

    if (existingGamertag) {
      return res.status(400).json({ error: 'Gamertag já existe nesta equipe.' });
    }

    // Para adicionar um membro real, precisaríamos do user_id dele.
    // Como não temos busca de usuários implementada, vamos assumir que o capitão está convidando via Discord ID
    // E vamos criar um convite ou adicionar direto se tivermos o ID.
    // Para este MVP, vamos simular a adição se tivermos o ID, ou retornar erro.
    
    // NOTA: Em um fluxo real, cria-se um convite em team_invitations e o usuário aceita.
    // Vou implementar a criação do convite aqui.
    
    if (!validatedData.discord_id) {
       return res.status(400).json({ error: 'Discord ID necessário para convite.' });
    }

    // Buscar user_id pelo discord_id (se possível, ou armazenar o discord_id no convite)
    // Supabase Auth não expõe busca de user por metadata facilmente via client sem ser admin total.
    // Vamos criar o convite baseado no discord_id.

    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('team_invitations')
      .insert({
        team_id: teamId,
        invited_by: req.user!.id,
        discord_id: validatedData.discord_id,
        status: 'pending'
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    res.status(201).json({ message: 'Convite enviado com sucesso.', invitation });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.issues });
    }
    console.error('Erro ao adicionar membro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Remover Membro
 */
router.delete('/:id/members/:memberId', isAuthenticated, async (req, res) => {
  const teamId = req.params.id;
  const memberIdToRemove = req.params.memberId; // ID da tabela team_members, ou user_id? Vamos usar user_id para facilitar

  try {
    const { data: team, error: fetchError } = await supabaseAdmin
      .from('teams')
      .select('captain_id')
      .eq('id', teamId)
      .single();

    if (fetchError || !team) {
      return res.status(404).json({ error: 'Equipe não encontrada' });
    }

    const isAdminUser = req.user!.id === process.env.ADMIN_DISCORD_ID;
    const isCaptain = team.captain_id === req.user!.id;
    const isSelf = req.user!.id === memberIdToRemove;

    // Permissões: Capitão remove qualquer um, Admin remove qualquer um, Membro remove a si mesmo (sair)
    if (!isCaptain && !isAdminUser && !isSelf) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    if (isCaptain && memberIdToRemove === team.captain_id && !isAdminUser) {
      return res.status(400).json({ error: 'Capitão não pode se remover. Transfira a capitania ou delete a equipe.' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', memberIdToRemove);

    if (deleteError) throw deleteError;

    console.log(`[AUDIT] Usuário ${req.user!.id} removeu membro ${memberIdToRemove} da equipe ${teamId}`);
    res.json({ message: 'Membro removido com sucesso.' });

  } catch (error) {
    console.error('Erro ao remover membro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Banir Equipe (Admin apenas)
 */
router.post('/:id/ban', isAdmin, async (req, res) => {
  const teamId = req.params.id;
  const { reason } = req.body;

  try {
    const { error: updateError } = await supabaseAdmin
      .from('teams')
      .update({ status: 'banned', is_banned: true })
      .eq('id', teamId);

    if (updateError) throw updateError;

    console.log(`[AUDIT] Admin ${req.user!.id} baniu a equipe ${teamId}. Motivo: ${reason}`);
    res.json({ message: 'Equipe banida com sucesso.' });
  } catch (error) {
    console.error('Erro ao banir equipe:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota: Transferir Capitania
 */
router.post('/:id/transfer', isAuthenticated, async (req, res) => {
  const teamId = req.params.id;
  const { newCaptainId } = req.body;

  try {
    const { data: team, error: fetchError } = await supabaseAdmin
      .from('teams')
      .select('captain_id')
      .eq('id', teamId)
      .single();

    if (fetchError || !team) {
      return res.status(404).json({ error: 'Equipe não encontrada' });
    }

    const isAdminUser = req.user!.id === process.env.ADMIN_DISCORD_ID;

    if (team.captain_id !== req.user!.id && !isAdminUser) {
      return res.status(403).json({ error: 'Apenas o capitão pode transferir a liderança.' });
    }

    // Verificar se o novo capitão é membro da equipe
    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', newCaptainId)
      .single();

    if (memberError || !member) {
      return res.status(400).json({ error: 'O novo capitão deve ser membro da equipe.' });
    }

    // Atualizar roles
    // 1. Definir antigo capitão como membro
    await supabaseAdmin
      .from('team_members')
      .update({ role: 'member' })
      .eq('team_id', teamId)
      .eq('user_id', team.captain_id);

    // 2. Definir novo capitão como captain
    await supabaseAdmin
      .from('team_members')
      .update({ role: 'captain' })
      .eq('team_id', teamId)
      .eq('user_id', newCaptainId);

    // 3. Atualizar tabela teams
    const { error: updateError } = await supabaseAdmin
      .from('teams')
      .update({ captain_id: newCaptainId })
      .eq('id', teamId);

    if (updateError) throw updateError;

    console.log(`[AUDIT] Capitania da equipe ${teamId} transferida de ${team.captain_id} para ${newCaptainId}`);
    res.json({ message: 'Capitania transferida com sucesso.' });

  } catch (error) {
    console.error('Erro ao transferir capitania:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
