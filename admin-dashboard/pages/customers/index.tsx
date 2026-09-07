import React, { useEffect, useMemo, useState } from 'react';
import ProtectedLayout from '../../components/ProtectedLayout';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  where,
  serverTimestamp,
  runTransaction,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore';

type Customer = {
  id?: string;
  name: string;
  phone?: string;
  createdAt?: any;
  updatedAt?: any;
  userId?: string;
};

type SaleSummary = {
  id: string;
  total: number;
  paid: number;
  date?: any;
  outstanding?: number;
};

export default function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Customer>({ name: '', phone: '' });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [paymentsBusy, setPaymentsBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const col = collection(db, `users/${user.uid}/customers`);
    const q = query(col, orderBy('name', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const items: Customer[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          items.push({
            id: d.id,
            name: data.name,
            phone: data.phone,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            userId: data.userId,
          });
        });
        setCustomers(items);
        setLoading(false);
      },
      (err) => {
        console.error('customers snapshot error', err);
        setError('Failed to load customers');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q));
  }, [customers, search]);

  function openNew() {
    setEditing(null);
    setForm({ name: '', phone: '' });
    setFormOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ ...c });
    setFormOpen(true);
  }

  async function save() {
    setError(null);
    if (!user) return setError('Not authenticated');
    if (!form.name || form.name.trim() === '') return setError('Customer name required');
    try {
      const col = collection(db, `users/${user.uid}/customers`);
      if (editing && editing.id) {
        const ref = doc(db, `users/${user.uid}/customers`, editing.id);
        await updateDoc(ref, {
          name: form.name,
          phone: form.phone || '',
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(col, {
          name: form.name,
          phone: form.phone || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          userId: user.uid,
        });
      }
      setFormOpen(false);
    } catch (err: any) {
      console.error('save customer error', err);
      setError(err.message || 'Failed to save customer');
    }
  }

  async function doDeleteCustomer() {
    if (!user || !confirmDelete || !confirmDelete.id) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/customers`, confirmDelete.id));
      setConfirmDelete(null);
    } catch (err: any) {
      console.error('delete customer error', err);
      setError(err.message || 'Failed to delete customer');
    }
  }

  async function loadPurchaseHistory(customer: Customer | null) {
    if (!user || !customer || !customer.id) return;
    try {
      setSelectedCustomer(customer);
      const salesRef = collection(db, `users/${user.uid}/sales`);
      const snap = await getDocs(query(salesRef, where('customerId', '==', customer.id), orderBy('date', 'desc')));
      const items: SaleSummary[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const total = Number(data.total || 0);
        const paid = Number(data.paid ?? data.paidAmount) || 0;
        items.push({ id: d.id, total, paid, date: data.date, outstanding: Math.max(0, total - paid) });
      });
      setSales(items);
    } catch (err) {
      console.error('load purchase history', err);
    }
  }

  async function recordPayment(saleId: string, amount: number) {
    if (!user || !selectedCustomer || !selectedCustomer.id) return;
    if (!saleId || !amount || amount <= 0) return setError('Invalid payment');
    setPaymentsBusy(true);
    try {
      const saleRef = doc(db, `users/${user.uid}/sales`, saleId);
      const custPaymentsCol = collection(db, `users/${user.uid}/customers/${selectedCustomer.id}/payments`);
      await runTransaction(db, async (tx) => {
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) throw new Error('Sale not found');
        const sale = saleSnap.data() as any;
        const currentPaid = Number(sale.paid ?? sale.paidAmount) || 0;
        const total = Number(sale.total || 0);
        const remaining = Math.max(0, total - currentPaid);
        const toApply = Math.min(remaining, amount);
        if (toApply <= 0) throw new Error('Sale already fully paid');
        tx.update(saleRef, { paid: currentPaid + toApply, updatedAt: serverTimestamp() });
        const paymentRef = doc(custPaymentsCol);
        tx.set(paymentRef, {
          saleId,
          amount: toApply,
          createdAt: serverTimestamp(),
          userId: user.uid,
        });
      });
      // refresh purchase history
      await loadPurchaseHistory(selectedCustomer);
    } catch (err: any) {
      console.error('record payment error', err);
      setError(err.message || 'Failed to record payment');
    } finally {
      setPaymentsBusy(false);
    }
  }

  return (
    <ProtectedLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <h2>Customers</h2>
          <div>
            <input placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button onClick={openNew} style={{ marginLeft: 8 }}>Add customer</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: 20, marginTop: 16 }}>
          <section style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            {loading && <div>Loading customers...</div>}
            {!loading && filtered.length === 0 && <div>No customers yet.</div>}
            {!loading && filtered.length > 0 && (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr><th>Name</th><th>Phone</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    // compute totals for this customer from sales: simple aggregate by querying sales where customerId==c.id
                    // For performance this could be cached; here we fetch on demand via loadPurchaseHistory
                    const totals = { totalPurchases: 0, totalPaid: 0, outstanding: 0 };
                    return (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.phone || '—'}</td>
                        <td>UGX {/* placeholder, use detailed view to see sums */}—</td>
                        <td>UGX —</td>
                        <td>UGX —</td>
                        <td>
                          <button onClick={() => loadPurchaseHistory(c)}>View</button>
                          <button onClick={() => openEdit(c)} style={{ marginLeft: 8 }}>Edit</button>
                          <button onClick={() => setConfirmDelete(c)} style={{ marginLeft: 8, color: '#b91c1c' }}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <aside style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            <h3>Purchase history</h3>
            {selectedCustomer ? (
              <>
                <div><strong>{selectedCustomer.name}</strong></div>
                <div style={{ marginTop: 8 }}>
                  {sales.length === 0 && <div>No sales for this customer.</div>}
                  {sales.map(s => (
                    <div key={s.id} style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                      <div>{s.date?.toDate ? s.date.toDate().toLocaleString() : '—'}</div>
                      <div>Total: UGX {s.total.toLocaleString()}</div>
                      <div>Paid: UGX {s.paid.toLocaleString()}</div>
                      <div>Outstanding: UGX {(s.outstanding || Math.max(0, s.total - s.paid)).toLocaleString()}</div>
                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => {
                          const raw = prompt('Amount to pay (UGX)');
                          const amt = Number(raw || '0');
                          if (amt > 0) recordPayment(s.id, amt);
                        }} disabled={paymentsBusy}>Record payment</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div>Select a customer and click View to see purchase history.</div>
            )}
          </aside>
        </div>

        {/* add/edit modal */}
        {isFormOpen && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: 20, width: 540, borderRadius: 8 }}>
              <h3>{editing ? 'Edit customer' : 'Add customer'}</h3>
              <div>
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: '100%' }} />
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%' }} />
                <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setFormOpen(false)}>Cancel</button>
                  <button onClick={save}>Save</button>
                </div>
                {error && <div style={{ color: 'red' }}>{error}</div>}
              </div>
            </div>
          </div>
        )}

        {/* delete confirm */}
        {confirmDelete && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: 20, width: 420, borderRadius: 8 }}>
              <h3>Delete customer</h3>
              <p>Delete {confirmDelete.name}? This will not delete historical sales.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button onClick={doDeleteCustomer} style={{ background: '#b91c1c', color: '#fff' }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
