import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const cleanEnv = (val: string | undefined): string => {
      if (!val) return '';
      return val.trim().replace(/^["']|["']$/g, '');
    };

    const webhookSecret = cleanEnv(process.env.RAZORPAY_WEBHOOK_SECRET);

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not defined');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('Webhook signature mismatch');
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const payload = event.payload;

    const supabaseAdmin = createAdminClient();

    switch (event.event) {
      case 'subscription.authenticated':
      case 'subscription.charged': {
        const subscription = payload.subscription.entity;
        const userId = subscription.notes?.userId;
        const quantity = subscription.quantity || 1;

        if (!userId) {
          console.warn('Subscription event missing userId in notes');
          break;
        }

        const { error } = await supabaseAdmin
          .from('users')
          .update({
            tier: 'pro',
            seats: quantity,
            razorpay_subscription_id: subscription.id,
            razorpay_customer_id: subscription.customer_id,
          })
          .eq('id', userId);

        if (error) {
          console.error('Failed to update user tier to pro:', error);
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }
        break;
      }

      case 'subscription.halted':
      case 'subscription.cancelled': {
        const subscription = payload.subscription.entity;
        const userId = subscription.notes?.userId;

        if (!userId) {
          console.warn('Subscription event missing userId in notes');
          break;
        }

        const { error } = await supabaseAdmin
          .from('users')
          .update({
            tier: 'free',
            seats: 1,
            razorpay_subscription_id: null,
          })
          .eq('id', userId);

        if (error) {
          console.error('Failed to revert user tier to free:', error);
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }
        break;
      }

      default:
        console.log(`Unhandled Razorpay webhook event: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
