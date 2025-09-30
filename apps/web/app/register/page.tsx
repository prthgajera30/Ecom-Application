"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const [email, setEmail] = useState('newuser@example.com');
  const [password, setPassword] = useState('user123');
  const [msg, setMsg] = useState('');
  const { register } = useAuth();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await register(email, password);
      router.push('/');
    } catch (e) {
      setMsg('Register failed');
    }
  }

  return (
    <div className="max-w-sm mx-auto bg-white p-6 rounded-md shadow">
      <h2 className="text-lg font-semibold mb-4">Register</h2>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full border rounded px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button className="w-full bg-black text-white py-2 rounded" type="submit">Register</button>
      </form>
      {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
      <p className="mt-4 text-sm">Have an account? <Link className="underline" href="/login">Login</Link></p>
    </div>
  );
}
