import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const { deleteAccount } = useAuth();

  const handleDelete = async () => {
    if (!confirm('Delete your account? This cannot be undone.')) return;
    try {
      await deleteAccount();
      alert('Account deleted');
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <h1>Settings</h1>
      <button onClick={handleDelete} style={{ background: 'red', color: 'white' }}>Delete account</button>
    </div>
  );
}
