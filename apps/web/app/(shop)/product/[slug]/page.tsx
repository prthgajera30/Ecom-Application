"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiGet, apiPost } from '../../../../lib/api';

export default function ProductDetail() {
  const params = useParams();
  const slug = params?.slug as string;
  const [p, setP] = useState<any | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!slug) return;
    apiGet(`/products/slug/${slug}`).then(setP).catch(() => setP(null));
  }, [slug]);

  async function add() {
    if (!p) return;
    await apiPost('/cart/add', { productId: p._id, qty: 1 });
    setMsg('Added to cart');
    setTimeout(() => setMsg(''), 1000);
  }

  if (!p) return <p>Loading...</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        {p.images?.[0] && <img src={p.images[0]} alt={p.title} className="w-full rounded" />}
        {p.images?.[1] && <img src={p.images[1]} alt={p.title} className="w-full mt-3 rounded" />}
      </div>
      <div>
        <h1 className="text-2xl font-semibold mb-2">{p.title}</h1>
        <div className="text-gray-600 mb-4">${p.price / 100}</div>
        <p className="mb-4 whitespace-pre-line">{p.description}</p>
        <button className="bg-black text-white px-4 py-2 rounded" onClick={add}>Add to cart</button>
        {msg && <p className="mt-3 text-sm text-green-700">{msg}</p>}
      </div>
    </div>
  );
}
