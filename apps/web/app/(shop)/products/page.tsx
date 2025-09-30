"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '../../../lib/api';

export default function ProductsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    apiGet<{ items: any[] }>(`/products`).then((d) => setItems(d.items));
  }, []);
  async function add(pid: string) {
    await apiPost('/cart/add', { productId: pid, qty: 1 });
    setMsg('Added to cart');
    setTimeout(() => setMsg(''), 1000);
  }
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Products</h2>
      {msg && <p className="mb-3 text-sm text-green-700">{msg}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {items.map((p) => (
          <div key={p._id} className="bg-white border rounded-lg overflow-hidden shadow">
            <Link href={`/product/${p.slug}`}>
              {p.images?.[0] && <img src={p.images[0]} alt={p.title} className="w-full h-48 object-cover" />}
              <div className="p-4">
                <div className="font-medium mb-1 line-clamp-1">{p.title}</div>
                <div className="text-sm text-gray-600">${p.price / 100}</div>
              </div>
            </Link>
            <div className="px-4 pb-4">
              <button className="w-full bg-black text-white px-3 py-2 rounded" onClick={() => add(p._id)}>Add to cart</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
