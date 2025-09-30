"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '../lib/api';
import { getSocket } from '../lib/ws';

export default function Page() {
  const [health, setHealth] = useState<string>('loading...');
  const [connected, setConnected] = useState<boolean>(false);
  const [featured, setFeatured] = useState<any[]>([]);

  useEffect(() => {
    apiGet<{ ok: boolean }>("/health").then((d) => setHealth(d.ok ? 'OK' : 'ERR')).catch(() => setHealth('ERR'));
    apiGet<{ items: any[] }>("/products?limit=6").then((d) => setFeatured(d.items)).catch(() => setFeatured([]));
    const s = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <main>
      <section className="rounded-xl p-8 mb-8 border border-gray-200 bg-white">
        <h1 className="text-3xl font-semibold mb-2">Discover your next favorite item</h1>
        <p className="text-gray-600 mb-4">Personalized picks, live inventory, and a fast checkout.</p>
        <Link href="/products" className="btn-primary">Shop now</Link>
        <div className="mt-4 text-xs text-gray-500">API: {health} · WS: {connected ? 'connected' : 'offline'}</div>
      </section>

      <h2 className="text-xl font-semibold mb-4">Featured</h2>
      {featured.length === 0 && <p className="text-gray-600">No items yet. Try seeding, then refresh.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {featured.map((p) => (
          <Link key={p._id} href={`/product/${p.slug}`} className="card overflow-hidden">
            {p.images?.[0] && <img src={p.images[0]} alt={p.title} className="w-full h-48 object-cover" />}
            <div className="p-4">
              <div className="font-medium mb-1 line-clamp-1">{p.title}</div>
              <div className="text-sm text-gray-600">${p.price / 100}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
