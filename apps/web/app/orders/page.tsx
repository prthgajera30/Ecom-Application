"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/api';

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    async function load() {
      if (!token) return;
      const res = await fetch(`${API_BASE}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setOrders(await res.json());
    }
    load();
  }, [token]);

  if (!token) return <p>Please login to view your orders.</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Your Orders</h2>
      {orders.length === 0 && <p>No orders found.</p>}
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id} className="card p-4">
            <div className="font-medium">Order {o.id}</div>
            <div className="text-sm text-gray-600">Status: {o.status} · Total: ${(o.total || 0) / 100}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
