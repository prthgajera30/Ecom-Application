"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('user@example.com');
  const [password, setPassword] = useState('user123');
  const [msg, setMsg] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await login(email, password);
      router.push('/');
    } catch (e) {
      setMsg('Login failed');
    }
  }

  return (
    <div className="max-w-sm mx-auto bg-white p-6 rounded-md shadow">
      <h2 className="text-lg font-semibold mb-4">Login</h2>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full border rounded px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button className="btn-primary w-full" type="submit">Login</button>
      </form>
      {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
      <p className="mt-4 text-sm">No account? <Link className="underline" href="/register">Register</Link></p>
    </div>
  );
}
