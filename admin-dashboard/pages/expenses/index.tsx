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
  serverTimestamp,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore';

type Expense = {
  id?: string;
  category: string;
  amount: number;
  description?: string;
  date: any; // Firestore timestamp
  createdAt?: any;
  updatedAt?: any;
  userId?: string;
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // form state
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Expense>({ category: '', amount: 0, description: '', date: null });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '';

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const col = collection(db, `users/${user.uid}/expenses`);
    const q = query(col, orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const items: Expense[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          items.push({
            id: d.id,
            category: data.category,
            amount: Number(data.amount) || 0,
            description: data.description || '',
            date: data.date || data.createdAt || null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            userId: data.userId,
          });
        });
        setExpenses(items);
        setLoading(false);
      },
      (err) => {
        console.error('expenses snapshot error', err);
        setError('Failed to load expenses');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // filtering
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const q = search.trim().toLowerCase();
      if (q) {
        if (!(e.description || '').toLowerCase().includes(q) && !(e.category || '').toLowerCase().includes(q)) return false;
      }
      if (categoryFilter && categoryFilter !== 'all') {
        if (e.category !== categoryFilter) return false;
      }
      return true;
    });
  }, [expenses, search, categoryFilter]);

  // totals
  const totals = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let total = 0;
    let today = 0;
    let month = 0;
    for (const e of expenses) {
      const d = e.date && e.date.toDate ? e.date.toDate() : e.date instanceof Date ? e.date : null;
      const amt = Number(e.amount) || 0;
      total += amt;
      if (d) {
        if (d >= startOfToday) today += amt;
        if (d >= startOfMonth) month += amt;
      }
    }
    return { total, today, month };
  }, [expenses]);

  function openNew() {
    setEditing(null);
    setForm({ category: '', amount: 0, description: '', date: new Date() as any });
    setFormOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({ ...e });
    setFormOpen(true);
  }

  async function save() {
    setError(null);
    if (!user) return setError('Not authenticated');
    // validation
    if (!form.category || form.category.trim().length === 0) return setError('Category is required');
    if (!Number.isFinite(form.amount) || form.amount <= 0) return setError('Amount must be greater than 0');
    if (!form.date) return setError('Date is required');

    setBusy(true);
    try {
      const col = collection(db, `users/${user.uid}/expenses`);
      if (editing && editing.id) {
        const ref = doc(db, `users/${user.uid}/expenses`, editing.id);
        await updateDoc(ref, {
          category: form.category,
          amount: Number(form.amount),
          description: form.description || '',
          date: form.date,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(col, {
          category: form.category,
          amount: Number(form.amount),
          description: form.description || '',
          date: form.date,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          userId: user.uid,
        });
      }
      setFormOpen(false);
    } catch (err: any) {
      console.error('save expense error', err);
      setError(err.message || 'Failed to save expense');
    } finally {
      setBusy(false);
    }
  }

  // renamed from confirmDelete -> doDelete to avoid naming collision with state
  async function doDelete() {
    if (!user || !confirmDelete) return;
    setBusy(true);
    try {
      const ref = doc(db, `users/${user.uid}/expenses`, confirmDelete.id!);
      await deleteDoc(ref);
      setConfirmDelete(null);
    } catch (err: any) {
      console.error('delete expense error', err);
      setError(err.message || 'Failed to delete expense');
    } finally {
      setBusy(false);
    }
  }

  // categories from existing expenses
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) {
      if (e.category) set.add(e.category);
    }
    return Array.from(set).sort();
  }, [expenses]);

  return (
    <ProtectedLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <h2>Expenses</h2>
          <div style={{ fontSize: 13, color: '#555' }}>Support: 0730 518190 | Email: <em>{supportEmail || 'Set in NEXT_PUBLIC_SUPPORT_EMAIL'}</em></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, marginTop: 16 }}>
          <section style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Expenses</h3>
              <div>
                <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ padding: 8 }}>
                  <option value="">All categories</option>
                  <option value="all">(All existing)</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button onClick={openNew} style={{ marginLeft: 8, padding: '8px 12px' }}>Add expense</button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {loading && <div>Loading expenses...</div>}
              {error && <div style={{ color: 'red' }}>{error}</div>}
              {!loading && expenses.length === 0 && <div style={{ padding: 16, border: '1px dashed #ddd' }}>No expenses recorded yet.</div>}

              {!loading && expenses.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: 8 }}>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: 8 }}>{e.date?.toDate ? e.date.toDate().toLocaleDateString() : e.date instanceof Date ? e.date.toLocaleDateString() : '—'}</td>
                        <td>{e.category}</td>
                        <td>{e.description || '—'}</td>
                        <td style={{ textAlign: 'right' }}>UGX {Number(e.amount).toLocaleString()}</td>
                        <td>
                          <button onClick={() => openEdit(e)} style={{ marginRight: 8 }}>Edit</button>
                          <button onClick={() => setConfirmDelete(e)} style={{ color: '#b91c1c' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <aside style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            <h3>Summary</h3>
            <div style={{ marginBottom: 8 }}><strong>Total expenses:</strong> UGX {totals.total.toLocaleString()}</div>
            <div style={{ marginBottom: 8 }}><strong>Today's expenses:</strong> UGX {totals.today.toLocaleString()}</div>
            <div style={{ marginBottom: 8 }}><strong>This month:</strong> UGX {totals.month.toLocaleString()}</div>

            <div style={{ marginTop: 12 }}>
              <h4>Quick filters</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setCategoryFilter('')}>All</button>
                {categories.slice(0, 6).map((c) => (
                  <button key={c} onClick={() => setCategoryFilter(c)}>{c}</button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Form modal */}
        {isFormOpen && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: 20, width: 640, borderRadius: 8 }}>
              <h3>{editing ? 'Edit expense' : 'Add expense'}</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                <div>
                  <label>Category</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ width: '100%', padding: 8 }} />
                </div>
                <div>
                  <label>Amount (UGX)</label>
                  <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} style={{ width: '100%', padding: 8 }} />
                </div>
                <div>
                  <label>Date</label>
                  <input type="date" value={form.date && form.date.toDate ? form.date.toDate().toISOString().slice(0,10) : form.date instanceof Date ? form.date.toISOString().slice(0,10) : ''} onChange={(e) => setForm({ ...form, date: e.target.value ? new Date(e.target.value) as any : null })} style={{ width: '100%', padding: 8 }} />
                </div>
                <div>
                  <label>Description (optional)</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: '100%', padding: 8 }} />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setFormOpen(false)} disabled={busy}>Cancel</button>
                  <button onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                </div>
                {error && <div style={{ color: 'red' }}>{error}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: 20, width: 420, borderRadius: 8 }}>
              <h3>Confirm delete</h3>
              <p>Are you sure you want to delete this expense in category "{confirmDelete.category}" amount UGX {confirmDelete.amount.toLocaleString()}?</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmDelete(null)} disabled={busy}>Cancel</button>
                <button onClick={doDelete} disabled={busy} style={{ background: '#b91c1c', color: '#fff' }}>{busy ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
