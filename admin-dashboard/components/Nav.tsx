import Link from 'next/link';
import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Nav() {
  const { user, signOut } = useAuth();

  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #eee' }}>
      <div>
        <Link href="/" style={{ fontWeight: 700, fontSize: 18 }}>MobiBiz AI</Link>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Link href="/pricing">Pricing</Link>
        <Link href="/help">Help</Link>
        {user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/profile">Profile</Link>
            <button onClick={() => signOut()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#c00' }}>Logout</button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
