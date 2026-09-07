import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function Dashboard() {
  const { user } = useAuth();
  const [salesCount, setSalesCount] = useState<number | null>(null);
  const [expenseCount, setExpenseCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const salesRef = collection(db, `users/${user.uid}/sales`);
        const salesSnap = await getDocs(query(salesRef, orderBy('date', 'desc')));
        setSalesCount(salesSnap.size);

        const expensesRef = collection(db, `users/${user.uid}/expenses`);
        const expSnap = await getDocs(query(expensesRef, orderBy('date', 'desc')));
        setExpenseCount(expSnap.size);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (!user) return <div>Please sign in</div>;
  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto' }}>
      <h1>Dashboard</h1>
      <div>
        <p>Today's sales: {salesCount === 0 ? 'No data yet' : salesCount}</p>
        <p>Today's expenses: {expenseCount === 0 ? 'No data yet' : expenseCount}</p>
      </div>
    </div>
  );
}
