import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (user) return <div>Redirecting to dashboard...</div>;

  return (
    <div>
      <header style={{ padding: '2rem', borderBottom: '1px solid #eee' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>MobiBiz AI</h1>
            <p style={{ margin: 0 }}>Your Smart Everyday Business Assistant</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/login"><button>Login</button></Link>
            <Link href="/register"><button>Register</button></Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '2rem auto' }}>
        <section style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 40 }}>
          <div style={{ flex: 1 }}>
            <h2>Run your small business with confidence</h2>
            <p>MobiBiz AI helps small businesses manage sales, inventory, customers and finances — with AI-powered assistance tailored to your data.</p>
            <div style={{ marginTop: 16 }}>
              <Link href="/register"><button style={{ marginRight: 8 }}>Get started (Free)</button></Link>
              <Link href="#pricing"><button>See pricing</button></Link>
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ background: '#f5f7fb', borderRadius: 8, padding: 24 }}>
              <h3>Dashboard preview</h3>
              <p>Quickly see sales, expenses, stock and customers.</p>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>Features</h3>
          <ul>
            <li>Sales & expenses tracking</li>
            <li>Inventory & products</li>
            <li>Customer management & debts</li>
            <li>Receipts & invoices</li>
            <li>Ask MobiBiz AI — get suggestions and insights from your data</li>
            <li>Owner & admin tools</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>How It Works</h3>
          <ol>
            <li>Register and create your business profile.</li>
            <li>Add products, record sales and expenses.</li>
            <li>Use the dashboard and reports to understand performance.</li>
            <li>Ask MobiBiz AI for suggestions — AI uses only your server-side data.</li>
          </ol>
        </section>

        <section id="pricing" style={{ marginBottom: 40 }}>
          <h3>Pricing</h3>
          <p>We offer simple plans for small businesses. Payments are not active until a payment provider is connected.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid #ddd', padding: 12 }}>
              <h4>Weekly</h4>
              <p><strong>UGX 35,000</strong> / week</p>
              <p>Quick short-term access to core features.</p>
            </div>
            <div style={{ border: '1px solid #ddd', padding: 12 }}>
              <h4>Monthly</h4>
              <p><strong>UGX 60,000</strong> / month</p>
              <p>Core features, reasonable AI usage, up to 10 products and 20 customers.</p>
            </div>
            <div style={{ border: '1px solid #ddd', padding: 12 }}>
              <h4>Premium Monthly</h4>
              <p><strong>UGX 100,000</strong> / month</p>
              <p>Unlimited products/customers, advanced reports, more AI usage, ad-free.</p>
            </div>
            <div style={{ border: '1px solid #ddd', padding: 12 }}>
              <h4>Yearly</h4>
              <p><strong>UGX 400,000</strong> / year</p>
              <p>Best value for active businesses.</p>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>FAQ</h3>
          <div>
            <p><strong>Q: Is my data private?</strong></p>
            <p>A: Yes — your data is stored in your Firebase project and AI keys remain server-side.</p>
            <p><strong>Q: How do I upgrade?</strong></p>
            <p>A: Upgrading will be available once a payment provider is connected; this demo does not enable payments yet.</p>
          </div>
        </section>

        <section style={{ marginBottom: 80 }}>
          <h3>Contact & Support</h3>
          <p>Phone / WhatsApp: <strong>0730 518190</strong></p>
          <p>Business email: <em>Set in NEXT_PUBLIC_SUPPORT_EMAIL</em></p>
        </section>
      </main>

      <footer style={{ padding: '1rem', borderTop: '1px solid #eee' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>© MobiBiz AI</div>
      </footer>
    </div>
  );
}
