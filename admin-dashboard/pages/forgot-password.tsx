import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await resetPassword(email);
      setMessage('Password reset email sent');
    } catch (err: any) {
      setMessage(err.message || 'Failed to send reset email');
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h1>Reset password</h1>
      <form onSubmit={submit}>
        <div>
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required />
        </div>
        {message && <p>{message}</p>}
        <button type="submit">Send reset email</button>
      </form>
    </div>
  );
}
