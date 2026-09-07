import { useAuth } from '../hooks/useAuth';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <h1>Profile</h1>
      <pre>{JSON.stringify({ uid: user?.uid, email: user?.email, emailVerified: user?.emailVerified }, null, 2)}</pre>
    </div>
  );
}
