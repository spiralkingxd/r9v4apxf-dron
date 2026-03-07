import express from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { isAdmin } from '../middleware/auth';

const router = express.Router();

// Middleware to ensure all routes are protected
router.use(isAdmin);

// --- DASHBOARD STATS ---
router.get('/stats', async (req, res) => {
  try {
    const { count: usersCount } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
    const { count: teamsCount } = await supabaseAdmin.from('teams').select('*', { count: 'exact', head: true });
    const { count: eventsCount } = await supabaseAdmin.from('events').select('*', { count: 'exact', head: true });
    const { count: matchesCount } = await supabaseAdmin.from('matches').select('*', { count: 'exact', head: true });
    const { count: reportsCount } = await supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    res.json({
      users: usersCount || 0,
      teams: teamsCount || 0,
      events: eventsCount || 0,
      matches: matchesCount || 0,
      pendingReports: reportsCount || 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// --- USERS MANAGEMENT ---
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,display_name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%,discord_id.ilike.%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({ data, count, page, limit });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('profiles').update({ is_banned: true }).eq('id', id);
    if (error) throw error;
    
    // Log action
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'ban_user',
      target_type: 'user',
      target_id: id,
      details: { reason: 'Admin action' }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/users/:id/unban', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('profiles').update({ is_banned: false }).eq('id', id);
    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'unban_user',
      target_type: 'user',
      target_id: id,
      details: { reason: 'Admin action' }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Delete from auth.users (cascades to public.users)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'delete_user',
      target_type: 'user',
      target_id: id,
      details: { reason: 'Admin action' }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// --- TEAMS MANAGEMENT ---
router.get('/teams', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('teams')
      .select('*, captain:profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({ data, count, page, limit });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.post('/teams/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('teams').update({ status: 'banned' }).eq('id', id);
    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'ban_team',
      target_type: 'team',
      target_id: id,
      details: { reason: 'Admin action' }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error banning team:', error);
    res.status(500).json({ error: 'Failed to ban team' });
  }
});

router.post('/teams/:id/unban', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('teams').update({ status: 'active' }).eq('id', id);
    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'unban_team',
      target_type: 'team',
      target_id: id,
      details: { reason: 'Admin action' }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error unbanning team:', error);
    res.status(500).json({ error: 'Failed to unban team' });
  }
});

// ... previous imports and routes

// --- EVENTS MANAGEMENT ---
router.get('/events', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({ data, count, page, limit });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const { title, description, start_date, end_date, max_teams, prize_pool, rules, banner_url } = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        title,
        description,
        start_date,
        end_date,
        max_teams,
        prize_pool,
        rules,
        banner_url,
        created_by: req.user?.id, // Assuming req.user is populated
        status: 'draft'
      })
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'create_event',
      target_type: 'event',
      target_id: data.id,
      details: { title }
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { error } = await supabaseAdmin
      .from('events')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'update_event',
      target_type: 'event',
      target_id: id,
      details: updates
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('events').delete().eq('id', id);
    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'delete_event',
      target_type: 'event',
      target_id: id,
      details: { reason: 'Admin action' }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// --- MATCHES MANAGEMENT ---
router.get('/matches', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await supabaseAdmin
      .from('matches')
      .select('*, event:events(title), team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)', { count: 'exact' })
      .order('start_time', { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.json({ data, count, page, limit });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// --- REPORTS MANAGEMENT ---
router.get('/reports', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('reports')
      .select('*, reporter:profiles!reporter_id(full_name, email), reported_user:profiles!reported_user_id(full_name, email), reported_team:teams(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({ data, count, page, limit });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.post('/reports/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_notes, action } = req.body; // action could be 'ban_user', 'warning', etc.

    const { error } = await supabaseAdmin
      .from('reports')
      .update({ 
        status: 'resolved', 
        resolution_notes,
        resolved_by: req.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    // Handle side effects (e.g., banning user if action is 'ban')
    // This logic can be expanded based on requirements

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'resolve_report',
      target_type: 'report',
      target_id: id,
      details: { resolution_notes, action }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving report:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// --- LOGS MANAGEMENT ---
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await supabaseAdmin
      .from('admin_logs')
      .select('*, admin:profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.json({ data, count, page, limit });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// --- SETTINGS MANAGEMENT ---
router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('system_settings').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const { error } = await supabaseAdmin
      .from('system_settings')
      .update({ 
        value, 
        updated_by: req.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('key', key);

    if (error) throw error;

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: req.user?.id,
      action: 'update_setting',
      target_type: 'system',
      target_id: null,
      details: { key, value }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
