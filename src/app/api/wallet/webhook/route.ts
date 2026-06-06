import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { status, sessionId: payloadSessionId, amount, val_id } = body;

    // Validate webhook payload
    if (status !== 'verified') {
      return NextResponse.json({ message: 'Ignored: Status is not verified' });
    }

    if (!val_id) {
      return NextResponse.json({ error: 'Missing val_id' }, { status: 400 });
    }

    // Parse val_id: "wallet|uid123|sess_123"
    const parts = val_id.split('|');
    if (parts.length !== 3 || parts[0] !== 'wallet') {
      return NextResponse.json({ error: 'Invalid val_id format' }, { status: 400 });
    }

    const userId = parts[1];
    const sessionId = parts[2];

    const transactionRef = db.collection('wallet_transactions').doc(val_id);

    // Run transaction for atomicity and idempotency
    await db.runTransaction(async (t) => {
      const doc = await t.get(transactionRef);
      if (!doc.exists) {
        throw new Error('Transaction not found');
      }

      const data = doc.data();
      if (data?.credited === true) {
        // Already processed, exit transaction silently
        return;
      }

      const userRef = db.collection('users').doc(userId);
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const currentBalance = userData?.walletBalance || userData?.balance || 0;
      const newBalance = currentBalance + Number(amount);

      // Update user balance
      // Note: we update both balance and walletBalance just to be safe, depending on flutter app model
      t.update(userRef, { 
        balance: newBalance,
        walletBalance: newBalance 
      });

      // Mark transaction as credited
      t.update(transactionRef, {
        status: 'completed',
        credited: true,
        verifiedAt: new Date(),
        // Also update the fields required by standard transaction model if needed
        date: new Date().toISOString(),
      });
    });

    return NextResponse.json({ success: true, message: 'Wallet credited successfully' });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
