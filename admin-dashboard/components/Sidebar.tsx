import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/sales', label: 'Sales' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/products', label: 'Products' },
  { href: '/customers', label: 'Customers' },
  { href: '/debts', label: 'Debts' },
  { href: '/reports', label: 'Reports' },
  { href: '/receipts', label: 'Receipts/Invoices' },
  { href: '/ai', label: 'Ask MobiBiz AI' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* Mobile toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 }}>
        <strong>MobiBiz</strong>
        <button onClick={() => setOpen(o => !o)} aria-label="Toggle navigation">{open ? 'Close' : 'Menu'}</button>
      </div>

      <nav style={{ display: open ? 'block' : 'block' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {navItems.map(item => (
            <li key={item.href} style={{ marginBottom: 8 }}>
              <Link href={item.href} style={{ textDecoration: 'none' }}>
                <a style={{
                  display: 'block',
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: router.pathname === item.href ? '#eef2ff' : 'transparent',
                  color: router.pathname === item.href ? '#3730a3' : '#111',
                }}>{item.label}</a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
        <div style={{ marginBottom: 8 }}>Signed in as</div>
        <div style={{ fontWeight: 600 }}>{user?.email || 'Unknown'}</div>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => signOut()} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 12, fontSize: 13, color: '#555' }}>
        <div>Support: 0730 518190</div>
        <div style={{ marginTop: 6 }}>Email: <em>Set in NEXT_PUBLIC_SUPPORT_EMAIL</em></div>
      </div>
    </div>
  );
}
