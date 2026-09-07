import React from 'react';
import Nav from './Nav';
import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in to access this page.</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      <Nav />
      <div style={{ display: 'flex', flex: 1 }}>
        <aside style={{ width: 240, borderRight: '1px solid #eee', padding: 16 }}>
          <Sidebar />
        </aside>
        <main style={{ flex: 1, padding: 16 }}>{children}</main>
      </div>
    </div>
  );
}
