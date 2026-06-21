import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getSessionUser } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user } = session;

    const { planId } = await req.json();
    const targetSeats = 1; // 1 person = 1 license

    const cleanEnv = (val: string | undefined): string => {
      if (!val) return '';
      return val.trim().replace(/^["']|["']$/g, '');
    };

    const keyId = cleanEnv(process.env.RAZORPAY_KEY_ID);
    const keySecret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay keys not configured on server' }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const targetPlanId = planId === 'plan_Pro_1' || !planId
      ? cleanEnv(process.env.RAZORPAY_PLAN_ID || 'plan_Pro_1')
      : cleanEnv(planId);

    const subscription = await razorpay.subscriptions.create({
      plan_id: targetPlanId, 
      total_count: 12, // 12 billing cycles (recurring monthly/yearly)
      quantity: targetSeats,  // Always 1 seat/license per subscription
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
    const description = error.error?.description || error.description || error.message || 'Failed to create subscription';
    return NextResponse.json({ error: description }, { status: 500 });
  }
}
