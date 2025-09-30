import { Router } from 'express';
import { z } from 'zod';

const router = Router();

router.get('/recommendations', async (req, res) => {
  const schema = z.object({ userId: z.string().optional(), productId: z.string().optional(), k: z.coerce.number().min(1).max(20).optional() });
  const parse = schema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION' });
  const { userId, productId, k = 8 } = parse.data;
  const url = new URL(process.env.RECS_URL || 'http://recs:5000');
  url.pathname = '/recommendations';
  if (userId) url.searchParams.set('userId', userId);
  if (productId) url.searchParams.set('productId', productId);
  url.searchParams.set('k', String(k));
  const r = await fetch(url.toString());
  const json = await r.json();
  res.json(json);
});

export default router;
