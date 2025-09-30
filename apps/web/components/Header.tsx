'use client';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold text-black">Shop</Link>
        <nav className="flex gap-4 items-center">
          <Link href="/products" className="text-sm text-gray-700 hover:text-black">Products</Link>
          <Link href="/cart" className="text-sm text-gray-700 hover:text-black">Cart</Link>
          {!user ? (
            <div className="flex gap-3">
              <Link href="/login" className="btn-primary">Login</Link>
              <Link href="/register" className="btn-accent">Register</Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{user.email}</span>
              <button className="btn-primary" onClick={logout}>Logout</button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
