"use client";
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../lib/api';

type Cart = { items: { productId: string; qty: number }[] };

type Product = { _id: string; title: string; price: number; images?: string[] };

export default function CartPage() {
  const [cart, setCart] = useState<Cart>({ items: [] });
  const [products, setProducts] = useState<Record<string, Product>>({});

  useEffect(() => { apiGet<Cart>('/cart').then(setCart); }, []);

  useEffect(() => {
    async function load() {
      const ids = cart.items.map((i) => i.productId);
      const unique = Array.from(new Set(ids));
      const prods: Record<string, Product> = {};
      await Promise.all(unique.map(async (id) => {
        const p = await apiGet<Product>(`/products/${id}`);
        prods[id] = p;
      }));
      setProducts(prods);
    }
    if (cart.items.length) load();
  }, [cart.items]);

  const total = useMemo(() => cart.items.reduce((acc, i) => acc + (products[i.productId]?.price || 0) * i.qty, 0), [cart, products]);

  async function remove(productId: string) {
    const next = await apiPost<Cart>('/cart/remove', { productId });
    setCart(next);
  }

  async function updateQty(productId: string, qty: number) {
    const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
    if (safeQty <= 0) {
      await remove(productId);
      return;
    }
    const next = await apiPost<Cart>('/cart/update', { productId, qty: safeQty });
    setCart(next);
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Your Cart</h2>
      {cart.items.length === 0 && <p>Your cart is empty.</p>}
      <div className="space-y-3">
        {cart.items.map((i) => {
          const p = products[i.productId];
          return (
            <div key={i.productId} className="flex items-center gap-4 p-3 border rounded">
              {p?.images?.[0] ? (
                <img src={p.images[0]} alt={p.title} className="w-16 h-16 object-cover rounded" />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded" />
              )}
              <div className="flex-1">
                <div className="font-medium">{p?.title || i.productId}</div>
                <div className="text-sm text-gray-600">${((p?.price || 0) / 100).toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 border rounded" onClick={() => updateQty(i.productId, i.qty - 1)}>-</button>
                <input
                  className="w-12 border rounded text-center"
                  value={i.qty}
                  onChange={(e) => updateQty(i.productId, parseInt(e.target.value || '0', 10))}
                />
                <button className="px-2 py-1 border rounded" onClick={() => updateQty(i.productId, i.qty + 1)}>+</button>
              </div>
              <button className="text-red-600 text-sm" onClick={() => remove(i.productId)}>Remove</button>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div className="text-gray-600">Subtotal</div>
        <div className="text-lg font-semibold">${(total / 100).toFixed(2)}</div>
      </div>
      <div className="mt-4">
        <button className="btn-primary w-full">Proceed to Checkout</button>
      </div>
    </div>
  );
}
