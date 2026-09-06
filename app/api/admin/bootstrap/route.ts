import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, setCustomRole, recordAdminAuditLog, adminDb } from '@/lib/firebase-admin';

/**
 * Bootstrap endpoint for development, onboarding, or testing the Admin RBAC flow.
 * Allows an authenticated user to claim or verify the admin custom claim.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAuthToken(req);
    const targetUid = authUser.uid;

    // Check if any admin already exists in audit logs
    const existingAdminsSnap = await adminDb
      .collection('adminAuditLogs')
      .where('action', '==', 'BOOTSTRAP_ADMIN')
      .limit(1)
      .get()
      .catch(() => null);

    // Set custom claim to 'admin'
    await setCustomRole(targetUid, 'admin');

    const logId = await recordAdminAuditLog(
      targetUid,
      'BOOTSTRAP_ADMIN',
      targetUid,
      'SUCCESS',
      { email: authUser.email, note: 'Initial admin bootstrap execution' }
    );

    return NextResponse.json({
      success: true,
      role: 'admin',
      auditLogId: logId,
      message: 'Admin custom claim assigned. Please refresh your ID token via getIdToken(true).',
    });
  } catch (error: unknown) {
    console.error('Bootstrap admin error:', error);
    const msg = error instanceof Error ? error.message : 'Internal error during bootstrap';
    const status = msg.includes('Unauthorized') ? 401 : msg.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
