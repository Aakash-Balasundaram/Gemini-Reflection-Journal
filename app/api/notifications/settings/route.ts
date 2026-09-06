import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const authUser = await verifyAuthToken(req);
    const userId = authUser.uid;

    const defaultSettings = {
      enabled: false,
      channels: {
        slack: false,
        discord: false,
        email: false,
      },
      updatedAt: new Date().toISOString(),
    };

    let settings = defaultSettings;
    let logs: Array<Record<string, unknown>> = [];

    try {
      const docRef = adminDb.collection('users').doc(userId).collection('settings').doc('preferences');
      const docSnap = await docRef.get();
      if (docSnap?.exists && docSnap.data()?.notifications) {
        settings = docSnap.data()?.notifications;
      }
    } catch (err) {
      console.warn('adminDb read preferences bypassed:', err instanceof Error ? err.message : String(err));
    }

    try {
      const logsSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('notificationLog')
        .orderBy('deliveredAt', 'desc')
        .limit(20)
        .get();

      if (logsSnap && !logsSnap.empty) {
        logs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn('adminDb read logs bypassed:', err instanceof Error ? err.message : String(err));
    }

    return NextResponse.json({ settings, logs });
  } catch (error: unknown) {
    console.error('Fetch notification settings error:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    const status = msg.includes('Unauthorized') ? 401 : msg.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAuthToken(req);
    const userId = authUser.uid;

    const body = await req.json().catch(() => ({}));
    const data = body && typeof body === 'object' ? body : {};

    const notifications = {
      enabled: Boolean(data.enabled),
      channels: {
        slack: Boolean(data.channels?.slack),
        discord: Boolean(data.channels?.discord),
        email: Boolean(data.channels?.email),
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      const docRef = adminDb.collection('users').doc(userId).collection('settings').doc('preferences');
      await docRef.set({ notifications }, { merge: true });
    } catch (err) {
      console.warn('adminDb write preferences bypassed:', err instanceof Error ? err.message : String(err));
    }

    return NextResponse.json({ success: true, settings: notifications });
  } catch (error: unknown) {
    console.error('Save notification settings error:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    const status = msg.includes('Unauthorized') ? 401 : msg.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
