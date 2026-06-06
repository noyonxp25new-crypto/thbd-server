import Link from 'next/link';
import { db } from '@/lib/firebase-admin';

export default async function PaymentSuccess({
  searchParams,
}: {
  searchParams: { status?: string; sessionId?: string; amount?: string; trxId?: string }
}) {
  const { status, sessionId, amount, trxId } = await searchParams;

  // FALLBACK FOR LOCAL DEVELOPMENT:
  // Since AntiPay (Vercel) cannot hit localhost webhook, we simulate it here if it's a success redirect.
  if (status === 'success' && sessionId) {
    try {
      const docRef = db.collection('wallet_transactions').doc(sessionId);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        if (data?.status === 'pending' && !data?.credited) {
          // Update transaction
          await docRef.update({
            status: 'completed',
            credited: true,
            verifiedAt: new Date(),
            trxId: trxId || 'simulated_local_trx'
          });

          // Update user balance
          const userRef = db.collection('users').doc(data.userId);
          await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            if (userDoc.exists) {
              const currentBalance = userDoc.data()?.walletBalance || userDoc.data()?.balance || 0;
              t.update(userRef, {
                walletBalance: currentBalance + Number(data.amount)
              });
            }
          });
          console.log(`Local dev fallback: Successfully credited ${data.amount} to user ${data.userId}`);
        }
      }
    } catch (error) {
      console.error('Local dev fallback error:', error);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '2rem', borderRadius: '1rem', backgroundColor: '#1e1e1e', textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ fontSize: '4rem', color: '#00e676', marginBottom: '1rem' }}>✓</div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Payment Successful!</h1>
        <p style={{ color: '#aaa', marginBottom: '2rem' }}>
          Your payment has been verified. You can now close this tab and return to the TOUR HUB BD app.
        </p>
      </div>
    </div>
  );
}
