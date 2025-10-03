import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const shippingSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  rate: z.number().int().min(0),
  estimatedDays: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

router.get('/shipping-methods', async (_req, res) => {
  const methods = await prisma.shippingMethod.findMany({
    where: { active: true },
    orderBy: { rate: 'asc' },
  });
  res.json(methods);
});

router.post('/shipping-methods', requireAuth, requireRole('admin'), async (req, res) => {
  const parse = shippingSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const method = await prisma.shippingMethod.create({ data: parse.data });
  res.status(201).json(method);
});

router.put('/shipping-methods/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const parse = shippingSchema.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const existing = await prisma.shippingMethod.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });
  const method = await prisma.shippingMethod.update({ where: { id: existing.id }, data: parse.data });
  res.json(method);
});

router.delete('/shipping-methods/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const existing = await prisma.shippingMethod.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });
  await prisma.shippingMethod.delete({ where: { id: existing.id } });
  res.json({ success: true });
});

export default router;
