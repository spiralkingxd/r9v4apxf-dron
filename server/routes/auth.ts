import express from 'express';
import { supabaseAdmin } from '../lib/supabase';
import axios from 'axios';
import { isAuthenticated, isAdmin } from '../middleware/auth';

const router = express.Router();

router.post('/discord/sync', async (req, res) => {
  try {
    const { provider_token } = req.body;
    
    if (!provider_token) {
      return res.status(400).json({ error: 'Provider token is required' });
    }

    // Get user from the authorization header (Supabase JWT)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid user token' });
    }

    // Fetch connections from Discord
    const response = await axios.get('https://discord.com/api/users/@me/connections', {
      headers: {
        Authorization: `Bearer ${provider_token}`
      }
    });

    const connections = response.data;
    const xboxConnection = connections.find((conn: any) => conn.type === 'xbox');

    const xboxGamertag = xboxConnection ? xboxConnection.name : null;
    const xboxLinked = !!xboxConnection;

    // Extract metadata
    const metadata = user.user_metadata || {};
    const displayName = metadata.custom_claims?.global_name || metadata.full_name || metadata.name || '';
    const username = metadata.preferred_username || metadata.name || '';
    const avatarUrl = metadata.avatar_url || '';
    const discordId = metadata.provider_id || metadata.sub || '';

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        display_name: displayName,
        username: username,
        avatar_url: avatarUrl,
        email: user.email,
        discord_id: discordId,
        xbox_gamertag: xboxGamertag,
        xbox_linked: xboxLinked,
        // registered_at is handled by DEFAULT NOW() on insert, but we shouldn't overwrite it on update.
        // Supabase upsert will overwrite if we provide it, so we don't provide it.
      }, { onConflict: 'id' });

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({ success: true, xbox_linked: xboxLinked, xbox_gamertag: xboxGamertag });
  } catch (error: any) {
    console.error('Error syncing discord:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to sync discord data' });
  }
});

router.get('/profile/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const isOwnProfile = req.user?.id === id;
    
    // Check if user is admin
    let isUserAdmin = false;
    if (!isOwnProfile) {
      const { data: adminData } = await supabaseAdmin
        .from('admin_roles')
        .select('role')
        .eq('user_id', req.user?.id)
        .single();
      
      const sessionUser = await supabaseAdmin.auth.admin.getUserById(req.user?.id as string);
      const discordId = sessionUser.data.user?.user_metadata?.provider_id || sessionUser.data.user?.user_metadata?.sub;
      const envAdminId = process.env.VITE_ADMIN_DISCORD_ID || process.env.NEXT_PUBLIC_ADMIN_DISCORD_ID;
      
      isUserAdmin = !!adminData || (envAdminId && discordId === envAdminId);
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Profile not found' });
      }
      throw error;
    }

    // Hide email if not own profile and not admin
    if (!isOwnProfile && !isUserAdmin) {
      profile.email = '';
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.post('/profile/:id/refresh', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // In a real scenario, we would need the user's provider_token to fetch from Discord again.
    // However, since we don't store the provider_token, we can only refresh data from Supabase Auth metadata.
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);
    
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found in Auth' });
    }

    const metadata = user.user_metadata || {};
    const displayName = metadata.custom_claims?.global_name || metadata.full_name || metadata.name || '';
    const username = metadata.preferred_username || metadata.name || '';
    const avatarUrl = metadata.avatar_url || '';

    const { data: profile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        display_name: displayName,
        username: username,
        avatar_url: avatarUrl,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json(profile);
  } catch (error) {
    console.error('Error refreshing profile:', error);
    res.status(500).json({ error: 'Failed to refresh profile' });
  }
});

export default router;
