import { NextResponse } from 'next/server';
import { db, messaging } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tournamentId, secretKey } = body;

    // Very simple security check
    if (secretKey !== process.env.API_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!tournamentId) {
      return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
    }

    // Get the tournament
    const tourDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tourDoc.exists) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const tourData = tourDoc.data();
    const joinedPlayers: Record<string, string[]> = tourData?.joinedPlayers || {};

    // Collect all unique user IDs
    const userIds = Object.keys(joinedPlayers);

    if (userIds.length === 0) {
      return NextResponse.json({ message: 'No joined players to notify' });
    }

    // Fetch tokens for all userIds
    const tokens: string[] = [];
    
    // Firestore in query limit is 10, so chunk them or do individually
    for (const uid of userIds) {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const fcmTokens = userData?.fcmTokens || [];
        tokens.push(...fcmTokens);
      }
    }

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'No valid FCM tokens found' });
    }

    // Send multicast message
    const message = {
      notification: {
        title: 'রুম আইডি দেওয়া হয়েছে!',
        body: 'আপনার ম্যাচের রুম আইডি এবং পাসওয়ার্ড দেওয়া হয়েছে। অ্যাপে গিয়ে চেক করুন।',
      },
      tokens: Array.from(new Set(tokens)), // Remove duplicates
    };

    const response = await messaging.sendEachForMulticast(message);
    
    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    });

  } catch (error: any) {
    console.error('Error sending IDP notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
