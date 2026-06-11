import { NextResponse } from 'next/server';
import { db, messaging } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    
    const tournamentsSnapshot = await db.collection('tournaments')
      .where('status', 'in', ['upcoming', 'Ongoing', 'Upcoming', 'ongoing'])
      .get();

    let notifiedTournaments = 0;
    let totalMessagesSent = 0;

    for (const doc of tournamentsSnapshot.docs) {
      const tourData = doc.data();
      
      // --- 1. Match Reminder Logic ---
      if (tourData.matchDate) {
        let matchDateObj: Date;
        if (tourData.matchDate.toDate) {
          matchDateObj = tourData.matchDate.toDate();
        } else {
          matchDateObj = new Date(tourData.matchDate);
        }
        
        if (!isNaN(matchDateObj.getTime())) {
          const diffMs = matchDateObj.getTime() - now.getTime();
          const diffMins = Math.round(diffMs / 60000);

          // If exactly 5 minutes away
          if (diffMins === 5) {
            const joinedPlayers: Record<string, string[]> = tourData.joinedPlayers || {};
            const userIds = Object.keys(joinedPlayers);
            
            if (userIds.length > 0) {
              const tokens: string[] = [];
              for (const uid of userIds) {
                const userDoc = await db.collection('users').doc(uid).get();
                if (userDoc.exists) {
                  const userData = userDoc.data();
                  const fcmTokens = userData?.fcmTokens || [];
                  tokens.push(...fcmTokens);
                }
              }

              if (tokens.length > 0) {
                const title = 'ম্যাচ রিমাইন্ডার!';
                const bodyMsg = `আপনার ${tourData.title || 'টুর্নামেন্ট'} ম্যাচটি ৫ মিনিট পরে শুরু হবে। গেম ওপেন করে রেডি থাকুন।`;
                const message = {
                  notification: {
                    title: title,
                    body: bodyMsg,
                  },
                  tokens: Array.from(new Set(tokens)),
                };
                const response = await messaging.sendEachForMulticast(message);
                totalMessagesSent += response.successCount;
                notifiedTournaments++;

                // Save to Firestore
                const batch = db.batch();
                for (const uid of userIds) {
                  const notifRef = db.collection('notifications').doc();
                  batch.set(notifRef, {
                    userId: uid,
                    title: title,
                    message: bodyMsg,
                    isRead: false,
                    type: 'match_reminder',
                    tournamentId: doc.id,
                    createdAt: new Date().toISOString()
                  });
                }
                await batch.commit();
              }
            }
          }
        }
      }

      // --- 2. ID/Pass Notification Logic ---
      if (tourData.idp_status?.toLowerCase() === 'sent' && tourData.idpNotified !== true) {
        const joinedPlayers: Record<string, string[]> = tourData.joinedPlayers || {};
        const userIds = Object.keys(joinedPlayers);
        
        if (userIds.length > 0) {
          const tokens: string[] = [];
          for (const uid of userIds) {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              const fcmTokens = userData?.fcmTokens || [];
              tokens.push(...fcmTokens);
            }
          }

          if (tokens.length > 0) {
            const title = 'রুম আইডি ও পাসওয়ার্ড দেওয়া হয়েছে!';
            const bodyMsg = `আপনার ${tourData.title || 'টুর্নামেন্ট'} ম্যাচের রুম আইডি এবং পাসওয়ার্ড দেওয়া হয়েছে। অ্যাপে গিয়ে চেক করুন।`;
            const message = {
              notification: {
                title: title,
                body: bodyMsg,
              },
              tokens: Array.from(new Set(tokens)),
            };
            const response = await messaging.sendEachForMulticast(message);
            totalMessagesSent += response.successCount;

            // Save to Firestore
            const batch = db.batch();
            for (const uid of userIds) {
              const notifRef = db.collection('notifications').doc();
              batch.set(notifRef, {
                userId: uid,
                title: title,
                message: bodyMsg,
                isRead: false,
                type: 'idp_sent',
                tournamentId: doc.id,
                createdAt: new Date().toISOString()
              });
            }
            await batch.commit();
          }
        }
        
        // Mark as notified in DB so it doesn't trigger again
        await doc.ref.update({ idpNotified: true });
      }
    }

    return NextResponse.json({
      success: true,
      notifiedTournaments,
      totalMessagesSent
    });

  } catch (error: any) {
    console.error('Error running cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
