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

    const targetPlanId = planId === 'plan_Enterprise_1' || !planId
      ? cleanEnv(process.env.RAZORPAY_PLAN_ID || 'plan_Enterprise_1')
      : cleanEnv(planId);

    const subscription = await razorpay.subscriptions.create({
      plan_id: targetPlanId, 
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
    const description = error.error?.description || error.description || error.message || 'Failed to create subscription';
    
    const rawKeyId = process.env.RAZORPAY_KEY_ID || '';
    const rawKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
    
    const debug = {
      keyIdLength: rawKeyId.length,
      keyIdPrefix: rawKeyId.substring(0, 10),
      keySecretLength: rawKeySecret.length,
      keySecretPrefix: rawKeySecret.substring(0, 4),
      keySecretSuffix: rawKeySecret.length > 4 ? rawKeySecret.substring(rawKeySecret.length - 4) : '',
    };

    return NextResponse.json({ 
      error: description, 
      debug 
    }, { status: 500 });
  }
}
