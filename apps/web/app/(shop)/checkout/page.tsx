"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { apiGet, apiPost } from '../../../lib/api';

type CartItem = {
  productId: string;
  qty: number;
  price: number;
  currency: string;
  title: string;
  image: string | null;
};

type Address = {
  id: string;
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefault: boolean;
};

type ShippingMethod = {
  id: string;
  name: string;
  description?: string | null;
  rate: number;
  estimatedDays?: number | null;
};

type Promo = {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  description: string;
};

type Summary = {
  cart: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  shippingMethods: ShippingMethod[];
  addresses: Address[];
  defaultPromo: Promo | null;
};

const emptyAddressForm = {
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  phone: '',
  isDefault: false,
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}

function computeDiscount(promo: Promo | null, subtotal: number, shipping: number) {
  if (!promo) return 0;
  if (promo.type === 'percentage') return Math.round(subtotal * (promo.value / 100));
  return Math.min(promo.value, subtotal + shipping);
}

export default function CheckoutPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [savingAddress, setSavingAddress] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const refreshSummary = useCallback(
    async (preferredAddressId?: string) => {
      if (!token) return;
      try {
        setLoading(true);
        const data = await apiGet<Summary>('/checkout/summary', { token });
        setSummary(data);
        setSelectedAddress((prev) => {
          const candidate = preferredAddressId ?? prev;
          if (candidate && data.addresses.some((a) => a.id === candidate)) return candidate;
          const next = data.addresses.find((a) => a.isDefault) ?? data.addresses[0];
          return next ? next.id : null;
        });
        setSelectedShipping((prev) => {
          if (prev && data.shippingMethods.some((m) => m.id === prev)) return prev;
          return data.shippingMethods[0]?.id ?? null;
        });
        setPromo((prev) => {
          if (prev) return prev;
          if (data.defaultPromo) {
            setPromoInput((inputPrev) => inputPrev || data.defaultPromo!.code);
            return data.defaultPromo;
          }
          return null;
        });
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to load checkout information.');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    refreshSummary();
  }, [token, refreshSummary]);

  const totals = useMemo(() => {
    if (!summary) return { tax: 0, shipping: 0, discount: 0, total: 0 };
    const shippingRate = summary.shippingMethods.find((m) => m.id === selectedShipping)?.rate ?? summary.shipping;
    const tax = Math.round(summary.subtotal * 0.08);
    const discount = computeDiscount(promo, summary.subtotal, shippingRate);
    const total = Math.max(0, summary.subtotal + tax + shippingRate - discount);
    return { tax, shipping: shippingRate, discount, total };
  }, [summary, selectedShipping, promo]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Checkout</h2>
        <p className="text-gray-600">Please <Link href="/login" className="text-blue-600">log in</Link> to complete your purchase.</p>
      </div>
    );
  }

  if (loading) {
    return <p>Loading checkout details...</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (!summary || summary.cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <h2 className="text-2xl font-semibold">Checkout</h2>
        <p>Your cart is empty. <Link href="/products" className="text-blue-600">Continue shopping</Link>.</p>
      </div>
    );
  }

  async function handleAddressSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setSavingAddress(true);
    try {
      const payload = {
        fullName: addressForm.fullName,
        line1: addressForm.line1,
        line2: addressForm.line2 || undefined,
        city: addressForm.city,
        state: addressForm.state || undefined,
        postalCode: addressForm.postalCode,
        country: addressForm.country,
        phone: addressForm.phone || undefined,
        isDefault: addressForm.isDefault,
      };
      const newAddress = await apiPost<Address>('/addresses', payload, { token });
      await refreshSummary(newAddress.id);
      setShowAddressForm(false);
      setAddressForm(emptyAddressForm);
    } catch (err) {
      console.error(err);
      setError('Failed to save address.');
    } finally {
      setSavingAddress(false);
    }
  }

  async function applyPromoCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !promoInput.trim()) return;
    try {
      const result = await apiPost<Promo>('/checkout/promo', { code: promoInput.trim() }, { token });
      setPromo(result);
      setPromoError(null);
    } catch (err) {
      console.error(err);
      setPromo(null);
      setPromoError('Promo code not recognized.');
    }
  }

  async function placeOrder() {
    if (!token || !selectedAddress || !selectedShipping) return;
    setPlacingOrder(true);
    try {
      const response = await apiPost<{ order: { id: string } }>('/checkout/complete', {
        addressId: selectedAddress,
        shippingMethodId: selectedShipping,
        promoCode: promo?.code,
      }, { token });
      router.push(`/checkout/success?orderId=${response.order.id}`);
    } catch (err) {
      console.error(err);
      setError('Unable to place order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <section className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Shipping Address</h3>
            <button className="text-sm text-blue-600" onClick={() => setShowAddressForm((v) => !v)}>
              {showAddressForm ? 'Cancel' : 'Add new address'}
            </button>
          </div>
          {showAddressForm && (
            <form className="grid gap-3" onSubmit={handleAddressSubmit}>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col text-sm">
                  Full name
                  <input className="mt-1 border rounded px-3 py-2" value={addressForm.fullName} onChange={(e) => setAddressForm((f) => ({ ...f, fullName: e.target.value }))} required />
                </label>
                <label className="flex flex-col text-sm">
                  Phone
                  <input className="mt-1 border rounded px-3 py-2" value={addressForm.phone} onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))} />
                </label>
              </div>
              <label className="flex flex-col text-sm">
                Address line 1
                <input className="mt-1 border rounded px-3 py-2" value={addressForm.line1} onChange={(e) => setAddressForm((f) => ({ ...f, line1: e.target.value }))} required />
              </label>
              <label className="flex flex-col text-sm">
                Address line 2 (optional)
                <input className="mt-1 border rounded px-3 py-2" value={addressForm.line2} onChange={(e) => setAddressForm((f) => ({ ...f, line2: e.target.value }))} />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col text-sm">
                  City
                  <input className="mt-1 border rounded px-3 py-2" value={addressForm.city} onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))} required />
                </label>
                <label className="flex flex-col text-sm">
                  State
                  <input className="mt-1 border rounded px-3 py-2" value={addressForm.state} onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))} />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col text-sm">
                  Postal code
                  <input className="mt-1 border rounded px-3 py-2" value={addressForm.postalCode} onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))} required />
                </label>
                <label className="flex flex-col text-sm">
                  Country
                  <input className="mt-1 border rounded px-3 py-2" value={addressForm.country} onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))} required />
                </label>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                Set as default shipping address
              </label>
              <button className="btn-primary w-full" disabled={savingAddress}>
                {savingAddress ? 'Saving...' : 'Save address'}
              </button>
            </form>
          )}
          {!showAddressForm && summary.addresses.length > 0 && (
            <div className="space-y-3">
              {summary.addresses.map((addr) => (
                <label key={addr.id} className="flex gap-3 border rounded p-3 cursor-pointer">
                  <input type="radio" name="address" checked={selectedAddress === addr.id} onChange={() => setSelectedAddress(addr.id)} />
                  <div>
                    <div className="font-medium">{addr.fullName}</div>
                    <div className="text-sm text-gray-600">
                      {[addr.line1, addr.line2, `${addr.city}${addr.state ? `, ${addr.state}` : ''} ${addr.postalCode}`, addr.country]
                        .filter(Boolean)
                        .join(' | ')}
                    </div>
                    {addr.phone && <div className="text-sm text-gray-500">{addr.phone}</div>}
                    {addr.isDefault && <span className="text-xs text-green-600">Default</span>}
                  </div>
                </label>
              ))}
            </div>
          )}
          {!showAddressForm && summary.addresses.length === 0 && (
            <p className="text-sm text-gray-600">No addresses yet. Add one to continue.</p>
          )}
        </section>

        <section className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Delivery Options</h3>
          <div className="space-y-3">
            {summary.shippingMethods.map((method) => (
              <label key={method.id} className="flex justify-between border rounded p-3 cursor-pointer">
                <span>
                  <input
                    type="radio"
                    name="shipping"
                    className="mr-3"
                    checked={selectedShipping === method.id}
                    onChange={() => setSelectedShipping(method.id)}
                  />
                  <span className="font-medium">{method.name}</span>
                  {method.description && <span className="ml-2 text-sm text-gray-600">{method.description}</span>}
                  {method.estimatedDays && <span className="ml-2 text-xs text-gray-500">~{method.estimatedDays} days</span>}
                </span>
                <span className="font-semibold">{formatMoney(method.rate, summary.currency)}</span>
              </label>
            ))}
            {summary.shippingMethods.length === 0 && <p className="text-sm text-gray-600">No shipping methods configured.</p>}
          </div>
        </section>

        <section className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Promo Code</h3>
          <form className="flex gap-3" onSubmit={applyPromoCode}>
            <input className="flex-1 border rounded px-3 py-2" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="Enter code" />
            <button className="btn-secondary" type="submit">Apply</button>
          </form>
          {promo && <p className="mt-2 text-sm text-green-600">Applied: {promo.description}</p>}
          {promoError && <p className="mt-2 text-sm text-red-600">{promoError}</p>}
        </section>
      </div>

      <aside className="border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">Order Summary</h3>
        <div className="space-y-3">
          {summary.cart.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-gray-500">Qty {item.qty}</div>
              </div>
              <div>{formatMoney(item.price * item.qty, item.currency)}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(summary.subtotal, summary.currency)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>{formatMoney(totals.shipping, summary.currency)}</span></div>
          <div className="flex justify-between"><span>Tax (est.)</span><span>{formatMoney(totals.tax, summary.currency)}</span></div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatMoney(totals.discount, summary.currency)}</span></div>
          )}
          <div className="flex justify-between font-semibold text-base border-t border-gray-200 pt-3">
            <span>Total</span>
            <span>{formatMoney(totals.total, summary.currency)}</span>
          </div>
        </div>
        <button className="btn-primary w-full" disabled={!selectedAddress || !selectedShipping || placingOrder || summary.shippingMethods.length === 0} onClick={placeOrder}>
          {placingOrder ? 'Placing order...' : 'Place Order'}
        </button>
        <p className="text-xs text-gray-500">Payments are processed securely. When Stripe is unavailable we capture your order and confirm via email.</p>
      </aside>
    </div>
  );
}
