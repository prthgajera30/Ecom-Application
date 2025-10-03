"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { apiGet } from '../../../lib/api';

type OrderItem = {
  id: string;
  title: string;
  price: number;
  qty: number;
  image?: string | null;
};

type Address = {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
};

type ShippingMethod = {
  name: string;
  description?: string | null;
  estimatedDays?: number | null;
};

type Order = {
  id: string;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  items: OrderItem[];
  shippingAddress?: Address | null;
  shippingMethod?: ShippingMethod | null;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}

export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const orderId = params.get('orderId');
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !orderId) return;
    async function load() {
      try {
        const data = await apiGet<Order>(`/orders/${orderId}`, { token });
        setOrder(data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Unable to load your order at this time.');
      }
    }
    load();
  }, [token, orderId]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-semibold">Thank you for your order!</h2>
        <p className="text-gray-600 mt-2">We've emailed your confirmation and will notify you when your items ship.</p>
      </div>
      {!orderId && <p className="text-red-600">Missing order reference.</p>}
      {error && <p className="text-red-600">{error}</p>}
      {order && (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold">Order #{order.id.slice(0, 8)}</h3>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              {order.shippingAddress && (
                <div>
                  <div className="font-medium text-gray-800">Shipping to</div>
                  <div>{order.shippingAddress.fullName}</div>
                  <div>{order.shippingAddress.line1}</div>
                  {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
                  <div>
                    {order.shippingAddress.city}
                    {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''}
                    {' '}
                    {order.shippingAddress.postalCode}
                  </div>
                  <div>{order.shippingAddress.country}</div>
                  {order.shippingAddress.phone && <div>Phone: {order.shippingAddress.phone}</div>}
                </div>
              )}
              {order.shippingMethod && (
                <div>
                  <div className="font-medium text-gray-800">Delivery</div>
                  <div>{order.shippingMethod.name}</div>
                  {order.shippingMethod.description && <div>{order.shippingMethod.description}</div>}
                  {order.shippingMethod.estimatedDays && <div>Estimated {order.shippingMethod.estimatedDays} days</div>}
                </div>
              )}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-5 space-y-3">
            <h3 className="text-lg font-semibold">Items</h3>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <div className="font-medium text-gray-800">{item.title}</div>
                  <div className="text-gray-500">Qty {item.qty}</div>
                </div>
                <div>{formatMoney(item.price * item.qty, order.currency)}</div>
              </div>
            ))}
          </div>
          <div className="border border-gray-200 rounded-lg p-5 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal, order.currency)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{formatMoney(order.shipping, order.currency)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatMoney(order.tax, order.currency)}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatMoney(order.discount, order.currency)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base border-t border-gray-200 pt-3">
              <span>Total paid</span>
              <span>{formatMoney(order.total, order.currency)}</span>
            </div>
          </div>
        </div>
      )}
      <div className="pt-4">
        <Link href="/products" className="btn-secondary">Continue shopping</Link>
      </div>
    </div>
  );
}
