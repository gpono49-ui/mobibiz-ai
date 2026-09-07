import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function VerifyEmail() {
  const { user, sendVerification } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.emailVerified) setMessage('Email already verified');
  }, [user]);

  const resend = async () => {
    try {
      await sendVerification();
      setMessage('Verification email sent');
    } catch (err: any) {
      setMessage(err.message || 'Failed to send verification');
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h1>Verify email</h1>
      <p>{user?.email}</p>
      <p>{message}</p>
      <button onClick={resend}>Resend verification</button>
    </div>
  );
}
