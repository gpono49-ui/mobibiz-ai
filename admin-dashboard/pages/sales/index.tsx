import React, { useEffect, useState } from 'react';
import ProtectedLayout from '../../components/ProtectedLayout';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore';

type ProductItem = {
  id: string;
  name: string;
  sku?: string;
  sellingPrice: number;
  costPrice: number;
  quantity: number;
  lowStockThreshold: number;
};

type CustomerItem = {
  id: string;
  name: string;
  phone?: string;
};

type Sale = {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  paid: number; // standardized paid field
  paidAmount?: number; // legacy
  outstanding: number;
  customerId?: string | null;
  customerName?: string | null;
  paymentMethod?: string | null;
  createdAt?: any;
  userId?: string;
  items?: any[];
  date?: any;
};

export default function SalesPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  // form
  const [productId, setProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [customerId, setCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '';

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const prodCol = collection(db, `users/${user.uid}/products`);
    const prodQ = query(prodCol, orderBy('name'));
    const unsubProds = onSnapshot(prodQ, (snap: QuerySnapshot<DocumentData>) => {
      const items: ProductItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        items.push({
          id: d.id,
          name: data.name,
          sku: data.sku,
          sellingPrice: Number(data.sellingPrice) || 0,
          costPrice: Number(data.costPrice) || 0,
          quantity: Number(data.quantity) || 0,
          lowStockThreshold: Number(data.lowStockThreshold) || 0,
        });
      });
      setProducts(items);
      setLoading(false);
    }, (err) => {
      console.error('products snapshot error', err);
      setError('Failed to load products');
      setLoading(false);
    });

    const custCol = collection(db, `users/${user.uid}/customers`);
    const custQ = query(custCol, orderBy('name'));
    const unsubCust = onSnapshot(custQ, (snap: QuerySnapshot<DocumentData>) => {
      const items: CustomerItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        items.push({ id: d.id, name: data.name, phone: data.phone });
      });
      setCustomers(items);
    }, (err) => {
      console.error('customers snapshot error', err);
    });

    const salesCol = collection(db, `users/${user.uid}/sales`);
    const salesQ = query(salesCol, orderBy('createdAt', 'desc'));
    const unsubSales = onSnapshot(salesQ, (snap: QuerySnapshot<DocumentData>) => {
      const items: Sale[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        items.push({
          id: d.id,
          productId: data.productId,
          productName: data.productName,
          quantity: Number(data.quantity) || 0,
          unitPrice: Number(data.unitPrice) || 0,
          discount: Number(data.discount) || 0,
          total: Number(data.total) || 0,
          paid: Number(data.paid ?? data.paidAmount) || 0,
          paidAmount: Number(data.paidAmount) || 0,
          outstanding: Number(data.outstanding) || 0,
          customerId: data.customerId || null,
          customerName: data.customerName || null,
          paymentMethod: data.paymentMethod || null,
          createdAt: data.createdAt,
          userId: data.userId,
          items: data.items || [],
          date: data.date || data.createdAt,
        });
      });
      setSales(items);
    }, (err) => {
      console.error('sales snapshot error', err);
    });

    return () => {
      unsubProds();
      unsubCust();
      unsubSales();
    };
  }, [user]);

  useEffect(() => {
    // if product selected, set default unit price
    const p = products.find((x) => x.id === productId);
    if (p) setUnitPrice(p.sellingPrice);
  }, [productId, products]);

  const filteredSales = sales.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.productName.toLowerCase().includes(q) ||
      (s.customerId && customers.find((c) => c.id === s.customerId)?.name.toLowerCase().includes(q))
    );
  });

  async function saveSale() {
    setError(null);
    if (!user) return setError('Not authenticated');
    if (!productId) return setError('Select a product');
    if (!Number.isFinite(quantity) || quantity <= 0) return setError('Quantity must be a positive number');
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return setError('Unit price must be non-negative');
    if (!Number.isFinite(discount) || discount < 0) return setError('Discount must be non-negative');
    if (!Number.isFinite(paidAmount) || paidAmount < 0) return setError('Paid amount must be non-negative');

    setBusy(true);
    try {
      const prodRef = doc(db, `users/${user.uid}/products`, productId);
      const salesCol = collection(db, `users/${user.uid}/sales`);

      await runTransaction(db, async (tx) => {
        const prodSnap = await tx.get(prodRef as any);
        if (!prodSnap.exists()) {
          throw new Error('Product not found');
        }
        const prodData = prodSnap.data() as any;
        const currentStock = Number(prodData.quantity) || 0;
        if (quantity > currentStock) {
          throw new Error('Insufficient stock for this sale');
        }

        // Recalculate final prices
        const unit = Number(unitPrice);
        const disc = Number(discount);
        const total = Math.max(0, unit * quantity - disc);
        const paid = Math.min(Number(paidAmount), total);
        const outstanding = Math.max(0, total - paid);

        // decrement stock
        const newQty = currentStock - quantity;
        tx.update(prodRef as any, { quantity: newQty, updatedAt: serverTimestamp() });

        const saleRef = doc(salesCol);
        const customer = customers.find((c) => c.id === customerId);
        const saleItems = [{ productId, name: prodData.name || '', quantity, unitPrice: unit, discount: disc }];

        tx.set(saleRef as any, {
          productId: productId,
          productName: prodData.name || '',
          quantity,
          unitPrice: unit,
          discount: disc,
          total,
          // write both for compatibility; prefer 'paid'
          paid,
          paidAmount: paid,
          outstanding,
          customerId: customerId || null,
          customerName: customer ? customer.name : null,
          paymentMethod: paymentMethod || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          date: serverTimestamp(),
          items: saleItems,
          userId: user.uid,
        });
      });

      // success, clear form
      setProductId('');
      setQuantity(1);
      setUnitPrice(0);
      setDiscount(0);
      setPaidAmount(0);
      setCustomerId('');
      setPaymentMethod('cash');
    } catch (err: any) {
      console.error('saveSale error', err);
      setError(err.message || 'Failed to save sale');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <h2>Sales</h2>
          <div style={{ fontSize: 13, color: '#555' }}>Support: 0730 518190 | Email: <em>{supportEmail || 'Set in NEXT_PUBLIC_SUPPORT_EMAIL'}</em></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20, marginTop: 16 }}>
          <section style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            <h3>New Sale</h3>
            {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <label>Product</label>
                <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ width: '100%', padding: 8 }}>
                  <option value="">-- Select product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (UGX {p.sellingPrice.toLocaleString()}) — Stock: {p.quantity}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label>Quantity</label>
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} style={{ width: '100%', padding: 8 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Unit price (UGX)</label>
                  <input type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} style={{ width: '100%', padding: 8 }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label>Discount (UGX)</label>
                  <input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} style={{ width: '100%', padding: 8 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Paid amount (UGX)</label>
                  <input type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} style={{ width: '100%', padding: 8 }} />
                </div>
              </div>

              <div>
                <label>Customer (optional)</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ width: '100%', padding: 8 }}>
                  <option value="">-- Walk-in / none --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Payment method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: 8 }}>
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit / On account</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div>
                  <strong>Total:</strong>{' '}
                  {(() => {
                    const tot = Math.max(0, unitPrice * quantity - discount);
                    return <>UGX {tot.toLocaleString()}</>;
                  })()}
                </div>
                <div>
                  <button onClick={saveSale} disabled={busy} style={{ padding: '8px 12px' }}>{busy ? 'Saving...' : 'Save sale'}</button>
                </div>
              </div>
            </div>
          </section>

          <aside style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            <h3>Recent Sales</h3>
            <div style={{ marginBottom: 8 }}>
              <input placeholder="Search recent sales" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: 8 }} />
            </div>
            {loading && <div>Loading sales...</div>}
            {!loading && sales.length === 0 && <div>No sales yet.</div>}
            {!loading && sales.length > 0 && (
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: 6 }}>When</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: 6 }}>{s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : '—'}</td>
                        <td>{s.productName}</td>
                        <td>{s.quantity}</td>
                        <td>UGX {Number(s.total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </aside>
        </div>
      </div>
    </ProtectedLayout>
  );
}
