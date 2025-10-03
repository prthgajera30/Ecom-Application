import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index';
import { prisma, Session, Product } from '../db';

describe('checkout flow', () => {
  const token = jwt.sign({ userId: 'user-1', role: 'customer' }, 'change_me');
  const auth = { Authorization: `Bearer ${token}` };
  const sessionHeader = { 'x-session-id': 'sess-1' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns checkout summary for a cart', async () => {
    jest.spyOn(Session, 'findOne').mockResolvedValue({ cart: { items: [{ productId: 'prod-1', qty: 2 }] } } as any);
    jest.spyOn(Product, 'find').mockResolvedValue([
      { _id: { toString: () => 'prod-1' }, price: 1200, currency: 'usd', title: 'Sneaker', images: ['x'] },
    ] as any);
    jest.spyOn(Session, 'updateOne').mockResolvedValue({} as any);
    jest.spyOn(prisma.address, 'findMany').mockResolvedValue([
      {
        id: 'addr-1',
        userId: 'user-1',
        fullName: 'Tester',
        line1: '123 St',
        line2: null,
        city: 'Town',
        state: 'CA',
        postalCode: '94105',
        country: 'USA',
        phone: null,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);
    jest.spyOn(prisma.shippingMethod, 'findMany').mockResolvedValue([
      {
        id: 'ship-1',
        name: 'Standard',
        description: '5-7 days',
        rate: 500,
        estimatedDays: 5,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const res = await request(app)
      .get('/api/checkout/summary')
      .set(auth)
      .set(sessionHeader);

    expect(res.status).toBe(200);
    expect(res.body.subtotal).toBe(2400);
    expect(res.body.tax).toBeDefined();
    expect(res.body.addresses).toHaveLength(1);
    expect(res.body.shippingMethods).toHaveLength(1);
  });

  it('completes checkout with simulated payment when stripe missing', async () => {
    jest.spyOn(Session, 'findOne').mockResolvedValue({ cart: { items: [{ productId: 'prod-1', qty: 1 }] } } as any);
    jest.spyOn(Product, 'find').mockResolvedValue([
      { _id: { toString: () => 'prod-1' }, price: 2000, currency: 'usd', title: 'Bag', images: ['y'] },
    ] as any);
    jest.spyOn(prisma.address, 'findFirst').mockResolvedValue({ id: 'addr-1' } as any);
    jest.spyOn(prisma.shippingMethod, 'findFirst').mockResolvedValue({ id: 'ship-1', rate: 800, active: true } as any);
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'user-1', email: 'user@example.com' } as any);
    const orderRecord = {
      id: 'order-1',
      userId: 'user-1',
      subtotal: 2000,
      tax: 160,
      shipping: 800,
      discount: 200,
      total: 2760,
      currency: 'usd',
      status: 'paid',
      promoCode: 'SAVE10',
      shippingAddressId: 'addr-1',
      shippingMethodId: 'ship-1',
      items: [
        { id: 'item-1', productId: 'prod-1', title: 'Bag', price: 2000, qty: 1, image: 'y' },
      ],
      shippingAddress: {
        id: 'addr-1',
        fullName: 'Tester',
        line1: '123',
        line2: null,
        city: 'Town',
        state: 'CA',
        postalCode: '94105',
        country: 'USA',
        phone: null,
      },
      shippingMethod: { id: 'ship-1', name: 'Standard', rate: 800, description: null, estimatedDays: 5 },
    } as any;
    jest.spyOn(prisma.order, 'create').mockResolvedValue(orderRecord);
    const paymentSpy = jest.spyOn(prisma.payment, 'create').mockResolvedValue({} as any);
    const eventSpy = jest.spyOn(prisma.event, 'create').mockResolvedValue({} as any);
    jest.spyOn(Session, 'updateOne').mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/checkout/complete')
      .set(auth)
      .set(sessionHeader)
      .send({ addressId: 'addr-1', shippingMethodId: 'ship-1', promoCode: 'SAVE10' });

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe('order-1');
    expect(res.body.payment.simulated).toBe(true);
    expect(paymentSpy).toHaveBeenCalled();
    expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'order.confirmation_email' }) }));
  });
});
