import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { stripUndefined } from './sanitize';
import type { InteractionDocument } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Returns a reference to the user's isolated interactions subcollection:
 * Path: /users/{userId}/interactions
 */
export function getInteractionsCollection(userId: string) {
  if (!userId) throw new Error('userId is required for Firestore operations');
  return collection(db, 'users', userId, 'interactions');
}

/**
 * Subscribes to real-time updates of the user's interactions, ordered by updatedAt desc.
 */
export function subscribeToUserInteractions(
  userId: string,
  onData: (interactions: InteractionDocument[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const interactionsRef = getInteractionsCollection(userId);
  const q = query(interactionsRef, orderBy('updatedAt', 'desc'));
  const collectionPath = `users/${userId}/interactions`;

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InteractionDocument[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<InteractionDocument, 'id'>;
        items.push({
          id: docSnap.id,
          ...data,
        });
      });
      onData(items);
    },
    (err) => {
      console.error('Firestore snapshot subscription error:', err);
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, collectionPath);
    }
  );
}

/**
 * Saves or updates an interaction document in the user's isolated subcollection.
 * Guarantees zero-undefined payload sanitization.
 */
export async function persistInteraction(
  userId: string,
  interaction: InteractionDocument
): Promise<void> {
  if (!userId) throw new Error('Cannot persist interaction without an authenticated userId.');
  if (!interaction.id) throw new Error('Interaction must have a valid document id.');

  const docPath = `users/${userId}/interactions/${interaction.id}`;
  const docRef = doc(db, 'users', userId, 'interactions', interaction.id);
  const cleanPayload = stripUndefined({
    ...interaction,
    userId,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(docRef, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Deletes an interaction document from the user's isolated subcollection.
 */
export async function removeInteraction(
  userId: string,
  interactionId: string
): Promise<void> {
  if (!userId || !interactionId) {
    throw new Error('userId and interactionId are required to delete an interaction.');
  }

  const docPath = `users/${userId}/interactions/${interactionId}`;
  const docRef = doc(db, 'users', userId, 'interactions', interactionId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/**
 * Fetches a single interaction by id.
 */
export async function fetchInteraction(
  userId: string,
  interactionId: string
): Promise<InteractionDocument | null> {
  if (!userId || !interactionId) return null;
  const docPath = `users/${userId}/interactions/${interactionId}`;
  const docRef = doc(db, 'users', userId, 'interactions', interactionId);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<InteractionDocument, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

// ==========================================
// Notification Preferences & Audit Logs
// ==========================================

export interface NotificationSettingsData {
  enabled: boolean;
  channels: {
    slack: boolean;
    discord: boolean;
    email: boolean;
  };
  updatedAt?: string;
}

export interface NotificationLogData {
  id?: string;
  channel: 'slack' | 'discord' | 'email';
  triggerReason: string;
  deliveredAt: string;
  status: string;
  entryId: string;
  schemaVersion: string;
}

export interface AdminAuditLogData {
  id?: string;
  actorUid: string;
  action: string;
  targetUid: string;
  timestamp: string;
  result: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persists user notification settings into /users/{userId}/settings/preferences
 */
export async function saveNotificationPreferences(
  userId: string,
  settings: NotificationSettingsData
): Promise<void> {
  if (!userId) throw new Error('userId is required to save preferences.');
  const docPath = `users/${userId}/settings/preferences`;
  const docRef = doc(db, 'users', userId, 'settings', 'preferences');
  const payload = stripUndefined({
    notifications: {
      enabled: Boolean(settings.enabled),
      channels: {
        slack: Boolean(settings.channels?.slack),
        discord: Boolean(settings.channels?.discord),
        email: Boolean(settings.channels?.email),
      },
      updatedAt: new Date().toISOString(),
    },
  });

  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Loads user notification settings from /users/{userId}/settings/preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationSettingsData> {
  const defaultPrefs: NotificationSettingsData = {
    enabled: false,
    channels: { slack: false, discord: false, email: false },
  };
  if (!userId) return defaultPrefs;

  const docRef = doc(db, 'users', userId, 'settings', 'preferences');
  try {
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.notifications) {
      const notif = snap.data().notifications;
      return {
        enabled: Boolean(notif.enabled),
        channels: {
          slack: Boolean(notif.channels?.slack),
          discord: Boolean(notif.channels?.discord),
          email: Boolean(notif.channels?.email),
        },
        updatedAt: notif.updatedAt,
      };
    }
  } catch (err) {
    console.warn('Could not read user notification settings:', err);
  }
  return defaultPrefs;
}

/**
 * Persists a notification delivery log entry to /users/{userId}/notificationLog/{logId}
 */
export async function saveNotificationLog(
  userId: string,
  logEntry: NotificationLogData
): Promise<string> {
  if (!userId) throw new Error('userId is required to record notification log.');
  const logId = logEntry.id || 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const docPath = `users/${userId}/notificationLog/${logId}`;
  const docRef = doc(db, 'users', userId, 'notificationLog', logId);

  const cleanPayload = stripUndefined({
    ...logEntry,
    id: logId,
    deliveredAt: logEntry.deliveredAt || new Date().toISOString(),
  });

  try {
    await setDoc(docRef, cleanPayload);
    return logId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Real-time subscription to user notification delivery logs
 */
export function subscribeToNotificationLogs(
  userId: string,
  onData: (logs: NotificationLogData[]) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const logsCol = collection(db, 'users', userId, 'notificationLog');
  const q = query(logsCol, orderBy('deliveredAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: NotificationLogData[] = [];
      snapshot.forEach((d) => {
        logs.push({ id: d.id, ...(d.data() as Omit<NotificationLogData, 'id'>) });
      });
      onData(logs);
    },
    (err) => {
      console.warn('Notification log subscription error:', err);
      onData([]);
    }
  );
}

/**
 * Persists an immutable administrative audit log entry to /adminAuditLogs/{logId}
 */
export async function saveAdminAuditLog(
  actorUid: string,
  action: string,
  targetUid: string,
  result: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const logId = 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
  const docPath = `adminAuditLogs/${logId}`;
  const docRef = doc(db, 'adminAuditLogs', logId);

  const payload = stripUndefined({
    actorUid,
    action,
    targetUid,
    timestamp: new Date().toISOString(),
    result,
    metadata: metadata || {},
  });

  try {
    await setDoc(docRef, payload);
    return logId;
  } catch (error) {
    console.warn('saveAdminAuditLog error (bypassed):', error);
    return logId;
  }
}

/**
 * Subscribes to /adminAuditLogs for admin dashboard viewing
 */
export function subscribeToAdminAuditLogs(
  onData: (logs: AdminAuditLogData[]) => void
): Unsubscribe {
  const logsCol = collection(db, 'adminAuditLogs');
  const q = query(logsCol, orderBy('timestamp', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AdminAuditLogData[] = [];
      snapshot.forEach((d) => {
        logs.push({ id: d.id, ...(d.data() as Omit<AdminAuditLogData, 'id'>) });
      });
      onData(logs);
    },
    (err) => {
      console.warn('Admin audit log subscription error:', err);
      onData([]);
    }
  );
}

/**
 * Saves a user role to /roles/{targetUid}
 */
export async function saveUserRole(
  targetUid: string,
  role: 'admin' | 'moderator' | 'user'
): Promise<void> {
  if (!targetUid) throw new Error('targetUid is required');
  const docRef = doc(db, 'roles', targetUid);
  await setDoc(docRef, { role, updatedAt: new Date().toISOString() }, { merge: true });
}
