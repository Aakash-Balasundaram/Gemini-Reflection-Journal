import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, setCustomRole, recordAdminAuditLog } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // 1. Re-verify ID token server-side. Custom claims are the only trusted source for RBAC.
    const authUser = await verifyAuthToken(req);

    if (authUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin role required to perform this action.' },
        { status: 403 }
      );
    }

    // 2. Defensive Payload Ingestion
    const body = await req.json().catch(() => ({}));
    const data = body && typeof body === 'object' ? body : {};
    const targetUid = typeof data.targetUid === 'string' ? data.targetUid.trim() : '';
    const newRole = data.role;

    if (!targetUid) {
      return NextResponse.json(
        { error: 'Missing targetUid in request body.' },
        { status: 400 }
      );
    }

    if (!['admin', 'moderator', 'user'].includes(newRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: "admin", "moderator", "user".' },
        { status: 400 }
      );
    }

    // 3. Set custom user claim via Admin SDK
    await setCustomRole(targetUid, newRole);

    // 4. Mandatory Audit Logging
    const logId = await recordAdminAuditLog(
      authUser.uid,
      'SET_ROLE',
      targetUid,
      'SUCCESS',
      { newRole, actorEmail: authUser.email }
    );

    return NextResponse.json({
      success: true,
      targetUid,
      role: newRole,
      auditLogId: logId,
      message: `Successfully set custom claim role to ${newRole} for user ${targetUid}.`,
    });
  } catch (error: unknown) {
    console.error('Admin set-role error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    const status = msg.includes('Unauthorized') ? 401 : msg.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
