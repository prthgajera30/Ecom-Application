import { Router } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { prisma, Session, Product } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const hasStripe = !!STRIPE_SECRET && STRIPE_SECRET !== 'sk_test_xxx';
const stripe = hasStripe ? new Stripe(STRIPE_SECRET as string, { apiVersion: '2023-10-16' }) : null;

type Promo = { code: string; type: 'percentage' | 'fixed'; value: number; description: string };

const PROMO_CODES: Record<string, Promo> = {
  SAVE10: { code: 'SAVE10', type: 'percentage', value: 10, description: 'Save 10% on your order.' },
  FREESHIP: { code: 'FREESHIP', type: 'fixed', value: 500, description: 'Take $5 off shipping fees.' },
};

type CartItem = {
  productId: string;
  qty: number;
  price: number;
  currency: string;
  title: string;
  image: string | null;
};

function getSessionId(req: any): string {
  return (req.headers['x-session-id'] as string) || 'anon';
}

function normalizeCart(cart: any) {
  const map = new Map<string, number>();
  for (const it of cart?.items || []) {
    map.set(it.productId, (map.get(it.productId) || 0) + Number(it.qty || 0));
  }
  return Array.from(map.entries()).map(([productId, qty]) => ({ productId, qty }));
}

async function loadCart(sessionId: string): Promise<{ items: CartItem[]; subtotal: number; currency: string }> {
  const session = await Session.findOne({ sessionId });
  const normalized = normalizeCart(session?.cart);
  if (!normalized.length) return { items: [], subtotal: 0, currency: 'usd' };
  const ids = normalized.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } });
  const map = new Map<string, any>();
  for (const p of products) {
    map.set(p._id.toString(), p);
  }
  const items: CartItem[] = normalized.map(({ productId, qty }) => {
    const product = map.get(productId);
    const price = product?.price ?? 0;
    const currency = product?.currency ?? 'usd';
    return {
      productId,
      qty,
      price,
      currency,
      title: product?.title ?? 'Product',
      image: product?.images?.[0] ?? null,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const currency = items.find((i) => !!i.currency)?.currency || 'usd';
  return { items, subtotal, currency };
}

function calcTax(subtotal: number): number {
  return Math.round(subtotal * 0.08);
}

function resolvePromo(code?: string): Promo | null {
  if (!code) return null;
  return PROMO_CODES[code.trim().toUpperCase()] ?? null;
}

function calculateDiscount(promo: Promo | null, subtotal: number, shipping: number): number {
  if (!promo) return 0;
  if (promo.type === 'percentage') {
    return Math.round(subtotal * (promo.value / 100));
  }
  // fixed amount applies against shipping first then subtotal
  return Math.min(promo.value, shipping + subtotal);
}

router.get('/checkout/summary', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId as string;
  const sessionId = getSessionId(req);
  const { items, subtotal, currency } = await loadCart(sessionId);
  if (!items.length) {
    return res.json({
      cart: [],
      subtotal: 0,
      tax: 0,
      shipping: 0,
      total: 0,
      currency,
      shippingMethods: [],
      addresses: [],
      defaultPromo: null,
    });
  }

  await Session.updateOne({ sessionId }, { $set: { userId, updatedAt: new Date() } }).catch(() => undefined);

  const [addresses, shippingMethods] = await Promise.all([
    prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }),
    prisma.shippingMethod.findMany({ where: { active: true }, orderBy: { rate: 'asc' } }),
  ]);

  const tax = calcTax(subtotal);
  const shipping = shippingMethods[0]?.rate ?? 0;
  const total = subtotal + tax + shipping;

  res.json({
    cart: items,
    subtotal,
    tax,
    shipping,
    total,
    currency,
    shippingMethods,
    addresses,
    defaultPromo: PROMO_CODES.SAVE10,
  });
});

const promoSchema = z.object({ code: z.string().min(1) });

router.post('/checkout/promo', requireAuth, async (req, res) => {
  const parse = promoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const promo = resolvePromo(parse.data.code);
  if (!promo) return res.status(404).json({ error: 'INVALID_PROMO' });
  res.json(promo);
});

const completeSchema = z.object({
  addressId: z.string().min(1),
  shippingMethodId: z.string().min(1),
  promoCode: z.string().optional(),
});

router.post('/checkout/complete', requireAuth, async (req, res) => {
  const parse = completeSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { addressId, shippingMethodId, promoCode } = parse.data;
  const userId = (req as any).user.userId as string;
  const sessionId = getSessionId(req);
  const { items, subtotal, currency } = await loadCart(sessionId);
  if (!items.length) return res.status(400).json({ error: 'CART_EMPTY' });

  const [address, shippingMethod, user] = await Promise.all([
    prisma.address.findFirst({ where: { id: addressId, userId } }),
    prisma.shippingMethod.findFirst({ where: { id: shippingMethodId, active: true } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!address) return res.status(404).json({ error: 'ADDRESS_NOT_FOUND' });
  if (!shippingMethod) return res.status(404).json({ error: 'SHIPPING_NOT_FOUND' });

  const tax = calcTax(subtotal);
  const shipping = shippingMethod.rate;
  const promo = resolvePromo(promoCode);
  if (promoCode && !promo) return res.status(400).json({ error: 'INVALID_PROMO' });
  const discount = calculateDiscount(promo, subtotal, shipping);
  const total = Math.max(0, subtotal + tax + shipping - discount);

  const order = await prisma.order.create({
    data: {
      userId,
      subtotal,
      tax,
      shipping,
      discount,
      total,
      currency,
      status: hasStripe ? 'pending' : 'paid',
      shippingAddressId: address.id,
      shippingMethodId: shippingMethod.id,
      promoCode: promo?.code,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          price: item.price,
          title: item.title,
          image: item.image ?? undefined,
        })),
      },
    },
    include: {
      items: true,
      shippingAddress: true,
      shippingMethod: true,
    },
  });

  if (!hasStripe) {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        stripePaymentIntentId: 'simulated',
        amount: total,
        status: 'succeeded',
      },
    });
  }

  await Session.updateOne({ sessionId }, { $set: { cart: { items: [] }, userId, updatedAt: new Date() } }).catch(() => undefined);

  await prisma.event.create({
    data: {
      userId,
      type: 'order.confirmation_email',
      payload: {
        orderId: order.id,
        email: user?.email ?? null,
        total,
      },
    },
  });

  if (!hasStripe) {
    return res.json({ order, payment: { simulated: true, status: 'succeeded' } });
  }

  try {
    const checkoutSession = await stripe!.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: 'Order total' },
            unit_amount: total,
          },
          quantity: 1,
        },
      ],
      success_url: process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:3000/checkout/success',
      cancel_url: process.env.CHECKOUT_CANCEL_URL || 'http://localhost:3000/checkout/cancel',
      metadata: { orderId: order.id },
    });
    res.json({ order, payment: { url: checkoutSession.url, simulated: false } });
  } catch (err) {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'canceled' } });
    return res.status(500).json({ error: 'PAYMENT_FAILED' });
  }
});

const sessionSchema = z.object({
  shippingMethodId: z.string().optional(),
  promoCode: z.string().optional(),
});

router.post('/checkout/create-session', requireAuth, async (req, res) => {
  if (!hasStripe) {
    return res.json({ simulated: true, url: null });
  }
  const parse = sessionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const sessionId = getSessionId(req);
  const { items, subtotal, currency } = await loadCart(sessionId);
  const shippingMethodId = parse.data.shippingMethodId;
  const shippingMethod = shippingMethodId
    ? await prisma.shippingMethod.findFirst({ where: { id: shippingMethodId, active: true } })
    : await prisma.shippingMethod.findFirst({ where: { active: true }, orderBy: { rate: 'asc' } });
  const shipping = shippingMethod?.rate ?? 0;
  const tax = calcTax(subtotal);
  const promo = resolvePromo(parse.data.promoCode);
  const discount = calculateDiscount(promo, subtotal, shipping);
  const total = Math.max(0, subtotal + tax + shipping - discount);

  try {
    const checkoutSession = await stripe!.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: 'Order total' },
            unit_amount: total,
          },
          quantity: 1,
        },
      ],
      success_url: process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:3000/checkout/success',
      cancel_url: process.env.CHECKOUT_CANCEL_URL || 'http://localhost:3000/checkout/cancel',
    });
    res.json({ url: checkoutSession.url, simulated: false });
  } catch (err) {
    res.status(500).json({ error: 'STRIPE_ERROR' });
  }
});

router.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;
  if (event.type === 'checkout.session.completed') {
    const orderId = event.data?.object?.metadata?.orderId as string | undefined;
    if (orderId) {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'paid' } }).catch(() => undefined);
      const paymentIntentId = event.data?.object?.payment_intent as string | undefined;
      if (paymentIntentId) {
        await prisma.payment.upsert({
          where: { orderId },
          update: { status: 'succeeded', stripePaymentIntentId: paymentIntentId, amount: event.data?.object?.amount_total ?? 0 },
          create: {
            orderId,
            stripePaymentIntentId: paymentIntentId,
            amount: event.data?.object?.amount_total ?? 0,
            status: 'succeeded',
          },
        }).catch(() => undefined);
      }
    }
  }
  res.json({ received: true });
});

export default router;
