/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Teams from './pages/Teams';
import Events from './pages/Events';
import Brackets from './pages/Brackets';
import Leaderboard from './pages/Leaderboard';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';

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
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="teams" element={<Teams />} />
            <Route path="events" element={<Events />} />
            <Route path="brackets" element={<Brackets />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            
            {/* Protected Routes */}
            <Route 
              path="dashboard" 
              element={
                <ProtectedRoute>
                  <UserDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin" 
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
