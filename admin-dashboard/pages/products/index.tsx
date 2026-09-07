import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import ProtectedLayout from '../../components/ProtectedLayout';
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

type Product = {
  id?: string;
  name: string;
  sku?: string;
  sellingPrice: number;
  costPrice: number;
  quantity: number;
  lowStockThreshold: number;
  createdAt?: any;
  updatedAt?: any;
};

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Product>({ name: '', sku: '', sellingPrice: 0, costPrice: 0, quantity: 0, lowStockThreshold: 0 });
  const [isDeleting, setIsDeleting] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '';

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const col = collection(db, `users/${user.uid}/products`);
    const q = query(col, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const items: Product[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          items.push({
            id: d.id,
            name: data.name,
            sku: data.sku,
            sellingPrice: data.sellingPrice ?? 0,
            costPrice: data.costPrice ?? 0,
            quantity: data.quantity ?? 0,
            lowStockThreshold: data.lowStockThreshold ?? 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setProducts(items);
        setLoading(false);
      },
      (err) => {
        console.error('products snapshot error', err);
        setError('Failed to load products');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Filtered products
  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()));

  // Free plan limit enforcement (client-side only)
  const MAX_FREE_PRODUCTS = 10;
  const reachedFreeLimit = products.length >= MAX_FREE_PRODUCTS;

  function openNew() {
    setEditing(null);
    setForm({ name: '', sku: '', sellingPrice: 0, costPrice: 0, quantity: 0, lowStockThreshold: 0 });
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ ...p });
    setFormOpen(true);
  }

  async function save() {
    if (!user) return setError('Not authenticated');
    setError(null);

    // Validation
    if (!form.name || form.name.trim().length < 1) return setError('Product name is required');
    if (form.sellingPrice < 0 || form.costPrice < 0) return setError('Prices must be non-negative');
    if (form.quantity < 0) return setError('Quantity cannot be negative');
    if (form.lowStockThreshold < 0) return setError('Low stock threshold cannot be negative');

    // Enforce free client-side limit
    if (!editing && reachedFreeLimit) {
      setError(`Free plan allows up to ${MAX_FREE_PRODUCTS} products. Upgrade to add more.`);
      return;
    }

    setBusy(true);
    try {
      const col = collection(db, `users/${user.uid}/products`);
      if (editing && editing.id) {
        const ref = doc(db, `users/${user.uid}/products`, editing.id);
        await updateDoc(ref, {
          name: form.name,
          sku: form.sku || null,
          sellingPrice: Number(form.sellingPrice),
          costPrice: Number(form.costPrice),
          quantity: Number(form.quantity),
          lowStockThreshold: Number(form.lowStockThreshold),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(col, {
          name: form.name,
          sku: form.sku || null,
          sellingPrice: Number(form.sellingPrice),
          costPrice: Number(form.costPrice),
          quantity: Number(form.quantity),
          lowStockThreshold: Number(form.lowStockThreshold),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setFormOpen(false);
    } catch (err: any) {
      console.error('save product error', err);
      setError(err.message || 'Failed to save product');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!user || !isDeleting) return;
    setBusy(true);
    try {
      const ref = doc(db, `users/${user.uid}/products`, isDeleting.id!);
      await deleteDoc(ref);
      setIsDeleting(null);
    } catch (err: any) {
      console.error('delete product error', err);
      setError(err.message || 'Failed to delete product');
    } finally {
      setBusy(false);
    }
  }

  async function adjustStock(p: Product, delta: number) {
    if (!user || !p.id) return;
    if (!Number.isFinite(delta)) return;
    const newQty = p.quantity + delta;
    if (newQty < 0) return setError('Resulting stock cannot be negative');
    setBusy(true);
    try {
      const ref = doc(db, `users/${user.uid}/products`, p.id);
      await updateDoc(ref, {
        quantity: newQty,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error('adjust stock error', err);
      setError(err.message || 'Failed to adjust stock');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <h2>Products</h2>
          <div>
            <input placeholder="Search by name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginRight: 8, padding: 8 }} />
            <button onClick={openNew} disabled={busy || reachedFreeLimit} style={{ padding: '8px 12px' }}>Add product</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading && <div>Loading products...</div>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
          {!loading && products.length === 0 && (
            <div style={{ padding: 20, border: '1px dashed #ddd', borderRadius: 6 }}>No products yet. Click "Add product" to create your first product.</div>
          )}

          {!loading && products.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: 8 }}>Name</th>
                    <th>SKU</th>
                    <th>Price</th>
                    <th>Cost</th>
                    <th>Qty</th>
                    <th>Low stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 8 }}>{p.name}</td>
                      <td>{p.sku || '—'}</td>
                      <td>UGX {Number(p.sellingPrice).toLocaleString()}</td>
                      <td>UGX {Number(p.costPrice).toLocaleString()}</td>
                      <td>{p.quantity}</td>
                      <td>
                        {p.quantity <= p.lowStockThreshold ? (
                          <span style={{ color: '#b91c1c', fontWeight: 600 }}>Low</span>
                        ) : (
                          <span style={{ color: '#047857' }}>OK</span>
                        )}
                      </td>
                      <td>
                        <button onClick={() => openEdit(p)} style={{ marginRight: 8 }}>Edit</button>
                        <button onClick={() => setIsDeleting(p)} style={{ marginRight: 8 }}>Delete</button>
                        <button onClick={() => adjustStock(p, 1)} style={{ marginRight: 4 }}>+1</button>
                        <button onClick={() => adjustStock(p, -1)}>-1</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reachedFreeLimit && (
            <div style={{ marginTop: 12, padding: 12, background: '#fffbeb', border: '1px solid #fef3c7' }}>
              <strong>Free plan limit reached:</strong> You have {products.length} products. Free plan allows up to {MAX_FREE_PRODUCTS}. Upgrade to add more products.
            </div>
          )}

          <div style={{ marginTop: 20, fontSize: 13, color: '#555' }}>
            Support: 0730 518190 | Email: <em>{supportEmail || 'Set in NEXT_PUBLIC_SUPPORT_EMAIL'}</em>
          </div>
        </div>

        {/* Form modal */}
        {isFormOpen && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: 20, width: 640, borderRadius: 8 }}>
              <h3>{editing ? 'Edit product' : 'Add product'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%', padding: 8 }} />
                </div>
                <div>
                  <label>SKU</label>
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} style={{ width: '100%', padding: 8 }} />
                </div>
                <div>
                  <label>Selling price (UGX)</label>
                  <input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} min={0} style={{ width: '100%', padding: 8 }} />
                </div>
                <div>
                  <label>Cost price (UGX)</label>
                  <input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} min={0} style={{ width: '100%', padding: 8 }} />
                </div>
                <div>
                  <label>Quantity</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} min={0} style={{ width: '100%', padding: 8 }} />
                </div>
                <div>
                  <label>Low stock threshold</label>
                  <input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} min={0} style={{ width: '100%', padding: 8 }} />
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setFormOpen(false)} disabled={busy}>Cancel</button>
                <button onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
              </div>
              {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {isDeleting && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: 20, width: 420, borderRadius: 8 }}>
              <h3>Confirm delete</h3>
              <p>Are you sure you want to delete "{isDeleting.name}"? This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setIsDeleting(null)} disabled={busy}>Cancel</button>
                <button onClick={confirmDelete} disabled={busy} style={{ background: '#b91c1c', color: '#fff' }}>{busy ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
