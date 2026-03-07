import api from '../lib/api';

export interface Profile {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  email: string;
  discord_id: string;
  xbox_gamertag: string | null;
  xbox_linked: boolean;
  registered_at: string;
}

export const profileService = {
  getUserProfile: async (userId: string): Promise<Profile> => {
    const response = await api.get(`/auth/profile/${userId}`);
    return response.data;
  },
  
  refreshUserProfile: async (userId: string): Promise<Profile> => {
    const response = await api.post(`/auth/profile/${userId}/refresh`);
    return response.data;
  }
};
