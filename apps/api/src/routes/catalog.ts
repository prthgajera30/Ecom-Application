import { Router } from 'express';
import { z } from 'zod';
import { Product, Category } from '../db';

const router = Router();

function withImageFallback<T extends any>(doc: any) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  if (!obj.images || obj.images.length === 0) {
    obj.images = [`https://picsum.photos/seed/${obj._id}/600/600`];
  }
  return obj;
}

router.get('/products', async (req, res) => {
  const schema = z.object({ search: z.string().optional(), category: z.string().optional(), sort: z.enum(['price','popular']).optional(), page: z.coerce.number().min(1).optional(), limit: z.coerce.number().min(1).max(100).optional() });
  const parse = schema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { search, category, sort, page = 1, limit = 12 } = parse.data;
  const filter: any = {};
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (category) filter.categoryId = category;
  let query = Product.find(filter).skip((page - 1) * limit).limit(limit);
  if (sort === 'price') query = query.sort({ price: 1 });
  // popular sort placeholder: by stock ascending (simulates popularity)
  if (sort === 'popular') query = query.sort({ stock: 1 });
  const [items, total] = await Promise.all([query.exec(), Product.countDocuments(filter)]);
  const itemsWithImages = items.map(withImageFallback);
  res.json({ items: itemsWithImages, total, page, limit });
});

router.get('/products/:id', async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(withImageFallback(p));
});

router.get('/products/slug/:slug', async (req, res) => {
  const p = await Product.findOne({ slug: req.params.slug });
  if (!p) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(withImageFallback(p));
});

router.get('/categories', async (_req, res) => {
  const cats = await Category.find({}).exec();
  res.json(cats);
});

export default router;
