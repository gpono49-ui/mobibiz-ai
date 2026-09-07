import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

export default function AIPage() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [responses, setResponses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!user) return alert('Sign in');
    if (!prompt) return;
    setLoading(true);
    try {
      const fn = httpsCallable(functions, 'aiChat');
      const resp = await fn({ prompt });
      // Expect server to return { text }
      if (resp.data && resp.data.text) {
        setResponses(r => [...r, resp.data.text]);
      } else {
        alert('No AI response');
      }
    } catch (err: any) {
      alert(err.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: '2rem auto' }}>
      <h1>Ask MobiBiz AI</h1>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} style={{ width: '100%' }} />
      <button onClick={ask} disabled={loading}>{loading ? 'Asking...' : 'Ask'}</button>
      <div>
        {responses.map((r, i) => <div key={i} style={{ border: '1px solid #ddd', padding: 12, marginTop: 12 }}>{r}</div>)}
      </div>
    </div>
  );
}
