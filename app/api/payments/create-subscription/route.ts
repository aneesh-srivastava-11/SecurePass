import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getSessionUser } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user } = session;

    const { seats, planId } = await req.json();

    if (!seats || seats < 1) {
      return NextResponse.json({ error: 'At least 1 seat is required' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay keys not configured on server' }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId || 'plan_Enterprise_1', // Target Plan configured in Razorpay Dashboard
      total_count: 12, // 12 billing cycles (recurring monthly/yearly)
      quantity: seats,  // Number of purchased seats
      customer_notify: 1,
      notes: {
        userId: user.id,
        email: user.email!,
      }
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId,
    });
  } catch (error: any) {
    console.error('Subscription Creation Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create subscription' }, { status: 500 });
  }
}
