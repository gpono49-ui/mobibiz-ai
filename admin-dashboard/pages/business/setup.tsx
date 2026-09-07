import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function BusinessSetup() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const ref = collection(db, `users/${user.uid}/businesses`);
      await addDoc(ref, {
        name,
        type,
        ownerName,
        phone,
        email,
        address,
        currency: 'UGX',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId: user.uid,
      });
      router.push('/dashboard');
    } catch (err: any) {
      alert(err.message || 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <h1>Setup Business</h1>
      <form onSubmit={submit}>
        <div>
          <label>Business name</label>
          <input value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label>Type</label>
          <input value={type} onChange={e => setType(e.target.value)} required />
        </div>
        <div>
          <label>Owner name</label>
          <input value={ownerName} onChange={e => setOwnerName(e.target.value)} required />
        </div>
        <div>
          <label>Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} required />
        </div>
        <div>
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <label>Address</label>
          <input value={address} onChange={e => setAddress(e.target.value)} />
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Create business'}</button>
      </form>
    </div>
  );
}
