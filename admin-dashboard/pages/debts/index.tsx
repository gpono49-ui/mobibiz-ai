import React, { useEffect, useState } from 'react';
import ProtectedLayout from '../../components/ProtectedLayout';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function DebtsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      try {
        // load customers
        const custRef = collection(db, `users/${user.uid}/customers`);
        const custSnap = await getDocs(query(custRef, orderBy('name')));
        const customers: Record<string, any> = {};
        custSnap.forEach(d => customers[d.id] = { id: d.id, ...(d.data() as any) });

        // load sales
        const salesRef = collection(db, `users/${user.uid}/sales`);
        const salesSnap = await getDocs(query(salesRef, orderBy('date', 'desc')));
        const perCustomer: Record<string, { total: number; paid: number; outstanding: number; sales: any[] }> = {};
        salesSnap.forEach(d => {
          const data = d.data() as any;
          const cid = data.customerId || 'walkin';
          const total = Number(data.total || 0);
          const paid = Number(data.paid ?? data.paidAmount) || 0;
          const outstanding = Math.max(0, total - paid);
          if (!perCustomer[cid]) perCustomer[cid] = { total: 0, paid: 0, outstanding: 0, sales: [] };
          perCustomer[cid].total += total;
          perCustomer[cid].paid += paid;
          perCustomer[cid].outstanding += outstanding;
          perCustomer[cid].sales.push({ id: d.id, ...data, outstanding });
        });

        // build rows for customers that have outstanding or history
        const out: any[] = [];
        for (const cid of Object.keys(perCustomer)) {
          const info = perCustomer[cid];
          const cust = customers[cid] || { name: cid === 'walkin' ? 'Walk-in / None' : '(deleted)', phone: '' };
          out.push({ customerId: cid, name: cust.name, phone: cust.phone || '', total: info.total, paid: info.paid, outstanding: info.outstanding, sales: info.sales });
        }

        setRows(out.sort((a,b) => b.outstanding - a.outstanding));
      } catch (err: any) {
        console.error('debts load error', err);
        setError(err.message || 'Failed to load debts');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) return <div>Please sign in</div>;
  if (loading) return <div>Loading debts...</div>;

  return (
    <ProtectedLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2>Customer Debts</h2>
        {error && <div style={{ color: 'red' }}>{error}</div>}
        {rows.length === 0 && <div>No debt records found.</div>}
        {rows.length > 0 && (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  <th style={{ padding: 8 }}>Customer</th>
                  <th>Phone</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Unpaid sales</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.customerId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 8 }}>{r.name}</td>
                    <td>{r.phone || '—'}</td>
                    <td>UGX {Number(r.total).toLocaleString()}</td>
                    <td>UGX {Number(r.paid).toLocaleString()}</td>
                    <td>UGX {Number(r.outstanding).toLocaleString()}</td>
                    <td>
                      <div style={{ maxHeight: 120, overflow: 'auto' }}>
                        {r.sales.filter((s:any)=>s.outstanding>0).map((s:any) => (
                          <div key={s.id} style={{ padding: 6, borderBottom: '1px solid #efefef' }}>
                            <div><strong>{s.productName}</strong></div>
                            <div>Total: UGX {Number(s.total).toLocaleString()} — Outstanding: UGX {Number(s.outstanding).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
