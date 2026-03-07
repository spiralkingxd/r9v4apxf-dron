/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import Layout from './components/Layout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import Teams from './pages/Teams';
import Events from './pages/Events';
import Brackets from './pages/Brackets';
import Leaderboard from './pages/Leaderboard';
import UserDashboard from './pages/UserDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';

import TeamsPage from './pages/dashboard/teams';
import CreateTeamPage from './pages/dashboard/teams/create';
import TeamDetailsPage from './pages/dashboard/teams/details';

import AdminDashboard from './pages/admin/Dashboard';
import UsersPage from './pages/admin/Users';
import AdminTeamsPage from './pages/admin/Teams';
import AdminEventsPage from './pages/admin/Events';
import AdminMatchesPage from './pages/admin/Matches';
import AdminReportsPage from './pages/admin/Reports';
import AdminLogsPage from './pages/admin/Logs';
import AdminSettingsPage from './pages/admin/Settings';

// Protected Route Component
function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode, adminOnly?: boolean }) {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div></div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public & User Routes */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="teams" element={<Teams />} />
            <Route path="events" element={<Events />} />
            <Route path="brackets" element={<Brackets />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            
            {/* User Dashboard Routes */}
            <Route 
              path="dashboard" 
              element={
                <ProtectedRoute>
                  <UserDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="dashboard/teams" 
              element={
                <ProtectedRoute>
                  <TeamsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="dashboard/teams/create" 
              element={
                <ProtectedRoute>
                  <CreateTeamPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="dashboard/teams/:id" 
              element={
                <ProtectedRoute>
                  <TeamDetailsPage />
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* Admin Routes */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute adminOnly={true}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="teams" element={<AdminTeamsPage />} />
            <Route path="events" element={<AdminEventsPage />} />
            <Route path="matches" element={<AdminMatchesPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
