import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, amount } = body;

    if (!userId || !amount) {
      return NextResponse.json({ error: 'Missing userId or amount' }, { status: 400 });
    }

    // Create pending wallet transaction
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const val_id = `wallet|${userId}|${sessionId}`;
    
    await db.collection('wallet_transactions').doc(val_id).set({
      sessionId,
      userId,
      amount: Number(amount),
      type: 'deposit',
      source: 'antipay',
      status: 'pending',
      credited: false,
      createdAt: new Date(),
      verifiedAt: null
    });

    const antipayApiKey = process.env.ANTIPAY_API_KEY;
    if (!antipayApiKey) {
      console.error('ANTIPAY_API_KEY is not set');
      return NextResponse.json({ error: 'Payment gateway configuration error' }, { status: 500 });
    }

    // Call AntiPay API
    const baseUrl = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL
      : `http://${request.headers.get('host')}`;

    const webhookUrl = `${baseUrl}/api/wallet/webhook`;
    const successUrl = `${baseUrl}/payment/success`;
    const cancelUrl = `${baseUrl}/payment/cancel`;

    const antipayRes = await fetch('https://antipay-verify.vercel.app/api/v1/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': antipayApiKey
      },
      body: JSON.stringify({
        amount: Number(amount),
        val_id: val_id,
        webhook_url: webhookUrl,
        success_url: successUrl,
        cancel_url: cancelUrl
      })
    });

    if (!antipayRes.ok) {
      const errText = await antipayRes.text();
      console.error('AntiPay Error:', errText);
      return NextResponse.json({ error: 'Failed to create payment session with gateway' }, { status: 500 });
    }

    const antipayData = await antipayRes.json();
    
    return NextResponse.json({
      sessionId: val_id, // We return val_id as sessionId for the frontend
      paymentUrl: antipayData.payment_url
    });

  } catch (error: any) {
    console.error('Create Payment Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
