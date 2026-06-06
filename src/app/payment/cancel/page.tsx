import Link from 'next/link';

export default function PaymentCancel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '2rem', borderRadius: '1rem', backgroundColor: '#1e1e1e', textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ fontSize: '4rem', color: '#ff3d00', marginBottom: '1rem' }}>✗</div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Payment Cancelled</h1>
        <p style={{ color: '#aaa', marginBottom: '2rem' }}>
          You have cancelled the payment. You can close this tab and return to the TOUR HUB BD app to try again.
        </p>
      </div>
    </div>
  );
}
