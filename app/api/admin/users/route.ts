import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const authUser = await verifyAuthToken(req);

    if (authUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin role required.' },
        { status: 403 }
      );
    }

    // List users from Firebase Auth
    let usersList: Array<{
      uid: string;
      email?: string;
      displayName?: string;
      photoURL?: string;
      role: string;
      createdAt?: string;
      lastSignInTime?: string;
    }> = [];

    try {
      const authResult = await adminAuth.listUsers(50);
      usersList = (authResult.users as Array<{
        uid: string;
        email?: string;
        displayName?: string;
        photoURL?: string;
        customClaims?: Record<string, unknown>;
        metadata?: { creationTime?: string; lastSignInTime?: string };
      }>).map((u) => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || u.email?.split('@')[0] || 'User',
        photoURL: u.photoURL,
        role: (u.customClaims?.role as string) || 'user',
        createdAt: u.metadata?.creationTime,
        lastSignInTime: u.metadata?.lastSignInTime,
      }));
    } catch (authErr) {
      console.warn('adminAuth.listUsers fallback to Firestore query:', authErr);
      // If listUsers is restricted by service account scopes, read user documents from Firestore
      const usersSnap = await adminDb.collection('users').limit(50).get().catch(() => null);
      if (usersSnap && !usersSnap.empty) {
        usersList = usersSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => {
          const dData = d.data();
          return {
            uid: d.id,
            email: dData.email || 'user@example.com',
            displayName: dData.displayName || d.id.slice(0, 8),
            role: dData.role || 'user',
            createdAt: dData.createdAt || new Date().toISOString(),
          };
        });
      }
    }

    // Ensure the current requesting admin is included
    if (!usersList.some((u) => u.uid === authUser.uid)) {
      usersList.unshift({
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.email?.split('@')[0] || 'Admin',
        role: authUser.role,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ users: usersList });
  } catch (error: unknown) {
    console.error('Admin list users error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    const status = msg.includes('Unauthorized') ? 401 : msg.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
