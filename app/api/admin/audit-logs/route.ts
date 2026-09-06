import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const authUser = await verifyAuthToken(req);

    if (authUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin role required.' },
        { status: 403 }
      );
    }

    // Fetch immutable audit logs from Firestore /adminAuditLogs
    let logs: Array<Record<string, unknown>> = [];
    try {
      const logsSnap = await adminDb
        .collection('adminAuditLogs')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get()
        .catch(() => adminDb.collection('adminAuditLogs').limit(100).get());

      if (logsSnap && 'docs' in logsSnap) {
        logs = logsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      }
    } catch (err) {
      console.warn('adminDb query adminAuditLogs bypassed:', err instanceof Error ? err.message : String(err));
    }

    return NextResponse.json({ logs });
  } catch (error: unknown) {
    console.error('Admin audit logs error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    const status = msg.includes('Unauthorized') ? 401 : msg.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
