export type ReflectionMode = 'reflection' | 'summary' | 'brainstorm' | 'chat';

export interface TurnMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  model?: string;
}

export interface LocationData {
  placeId: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  source: 'google_places';
}

export interface NotificationSettings {
  enabled: boolean;
  channels: {
    slack: boolean;
    discord: boolean;
    email: boolean;
  };
}

export interface InteractionDocument {
  id: string;
  userId: string;
  title: string;
  mode: ReflectionMode;
  createdAt: string;
  updatedAt: string;
  turns: TurnMessage[];
  summary?: string;
  tags?: string[];
  pinned?: boolean;
  location?: LocationData;
  sentiment?: 'neutral' | 'positive' | 'reflective' | 'distressed';
}

export interface AdminAuditLogItem {
  id: string;
  actorUid: string;
  action: string;
  targetUid: string;
  timestamp: string;
  result: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationLogItem {
  id: string;
  channel: 'slack' | 'discord' | 'email';
  triggerReason: string;
  deliveredAt: string;
  status: string;
  entryId: string;
}

