import { Router } from 'express';
import { z } from 'zod';
import { Session, Product } from '../db';

const router = Router();

function getSessionId(req: any) {
  return (req.headers['x-session-id'] as string) || 'anon';
}

function normalizeCart(cart: any) {
  const map = new Map<string, number>();
  for (const it of cart.items || []) {
    map.set(it.productId, (map.get(it.productId) || 0) + Number(it.qty || 0));
  }
  cart.items = Array.from(map.entries()).map(([productId, qty]) => ({ productId, qty }));
  return cart;
}

router.get('/cart', async (req, res) => {
  const sessionId = getSessionId(req);
  const session = await Session.findOne({ sessionId });
  const cart = normalizeCart(session?.cart || { items: [] });
  res.json(cart);
});

router.post('/cart/add', async (req, res) => {
  const schema = z.object({ productId: z.string(), qty: z.number().min(1).default(1) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { productId, qty } = parse.data;
  const sessionId = getSessionId(req);
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: 'NOT_FOUND' });
  let session = await Session.findOne({ sessionId });
  if (!session) {
    session = await Session.create({ sessionId, cart: { items: [{ productId, qty }] }, updatedAt: new Date() });
  } else {
    const existing = session.cart?.items?.find((i: any) => i.productId === productId);
    if (existing) existing.qty += qty; else session.cart.items.push({ productId, qty });
    session.updatedAt = new Date();
    normalizeCart(session.cart);
    await session.save();
  }
  req.app.get('io').to('inventory').emit('cart:updated', session.cart);
  res.json(session.cart);
});

const updateSchema = z.object({ productId: z.string(), qty: z.number().min(0) });

async function handleUpdate(req: any, res: any) {
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { productId, qty } = parse.data;
  const sessionId = getSessionId(req);
  const session = await Session.findOne({ sessionId });
  if (!session) return res.json({ items: [] });
  if (qty === 0) {
    session.cart.items = session.cart.items.filter((i: any) => i.productId !== productId);
  } else {
    const it = session.cart.items.find((i: any) => i.productId === productId);
    if (it) it.qty = qty; else session.cart.items.push({ productId, qty });
  }
  session.updatedAt = new Date();
  normalizeCart(session.cart);
  await session.save();
  res.json(session.cart);
}

router.post('/cart/update', handleUpdate);
router.post('/cart/update-qty', handleUpdate);
router.put('/cart/update', handleUpdate);

router.post('/cart/remove', async (req, res) => {
  const schema = z.object({ productId: z.string() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION' });
  const { productId } = parse.data;
  const sessionId = getSessionId(req);
  const session = await Session.findOne({ sessionId });
  if (!session) return res.json({ items: [] });
  session.cart.items = session.cart.items.filter((i: any) => i.productId !== productId);
  session.updatedAt = new Date();
  await session.save();
  res.json(session.cart);
});

export default router;
