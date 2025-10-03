import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

const addressSchema = z.object({
  fullName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
});

router.use(requireAuth);

router.get('/addresses', async (req, res) => {
  const userId = (req as any).user.userId as string;
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' },
    ],
  });
  res.json(addresses);
});

router.post('/addresses', async (req, res) => {
  const parse = addressSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const userId = (req as any).user.userId as string;
  const data = parse.data;
  const created = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const address = await tx.address.create({ data: { ...data, userId } });
    return address;
  });
  res.status(201).json(created);
});

router.put('/addresses/:id', async (req, res) => {
  const parse = addressSchema.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const userId = (req as any).user.userId as string;
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });
  const data = parse.data;
  const updated = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const address = await tx.address.update({ where: { id: existing.id }, data });
    return address;
  });
  res.json(updated);
});

router.delete('/addresses/:id', async (req, res) => {
  const userId = (req as any).user.userId as string;
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });
  await prisma.address.delete({ where: { id: existing.id } });
  res.json({ success: true });
});

export default router;
