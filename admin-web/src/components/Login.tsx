import { useState, FormEvent } from 'react';
import { PawPrint, Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('admin@medpet.com');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-5 relative overflow-hidden bg-gradient-to-br from-brand-500 to-brand-800">
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10" />
      <div className="absolute -bottom-28 -left-24 w-96 h-96 rounded-full bg-white/10" />

      <form onSubmit={submit} className="relative w-full max-w-[384px] bg-white rounded-2xl p-8 shadow-float">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 grid place-items-center">
            <PawPrint className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-ink leading-none">MedPet Admin</h1>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--gray)' }}>Sign in to manage the store</p>
          </div>
        </div>

        {error && <div className="error" style={{ marginTop: 18 }}>{error}</div>}

        <label>Email</label>
        <div className="relative">
          <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--gray)' }} />
          <input className="!pl-11" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus />
        </div>

        <label>Password</label>
        <div className="relative">
          <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--gray)' }} />
          <input className="!pl-11 !pr-11" value={password} onChange={(e) => setPassword(e.target.value)} type={showPwd ? 'text' : 'password'} />
          <button type="button" onClick={() => setShowPwd((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent" style={{ color: 'var(--gray)' }}>
            {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <button className="btn w-full" style={{ marginTop: 22 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
