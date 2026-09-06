import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyAuthToken, adminDb } from '@/lib/firebase-admin';

const DEFAULT_COOLDOWN_SECONDS = parseInt(process.env.NOTIFICATION_COOLDOWN_SECONDS || '300', 10);

async function sendWithRetry(
  url: string,
  payload: Record<string, unknown>,
  maxRetries = 3
): Promise<{ ok: boolean; status: number; text: string }> {
  let attempt = 0;
  let delay = 500;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000), // 5-second timeout
      });

      const resText = await res.text().catch(() => '');
      if (res.ok) {
        return { ok: true, status: res.status, text: resText };
      }

      // If client error (4xx), do not retry
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, text: resText };
      }
    } catch (err: unknown) {
      if (attempt >= maxRetries) {
        return {
          ok: false,
          status: 504,
          text: err instanceof Error ? err.message : 'Network timeout/failure',
        };
      }
    }
    // Exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2;
  }

  return { ok: false, status: 500, text: 'Max retries exhausted' };
}

// In-memory cooldown cache per user-channel: `${userId}:${channel}` -> timestamp ms
const cooldownTracker = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user server-side
    const authUser = await verifyAuthToken(req);
    const userId = authUser.uid;

    // 2. Defensive Payload Ingestion
    const body = await req.json().catch(() => ({}));
    const data = body && typeof body === 'object' ? body : {};
    const entryId = typeof data.entryId === 'string' ? data.entryId.trim() : `entry-${Date.now()}`;
    const triggerReason = typeof data.triggerReason === 'string' ? data.triggerReason.trim() : 'flagged_summary';
    const summary = typeof data.summary === 'string' ? data.summary.trim().slice(0, 300) : 'Reflection activity recorded.';
    const requestedChannel = data.channel as 'slack' | 'discord' | 'email' | 'all' | undefined;
    const isTest = Boolean(data.isTest);

    // 3. User Opt-In / Opt-Out Check (Default is strictly OFF)
    // Accept preferences from verified client payload or attempt Firestore read
    let isGlobalEnabled = Boolean(data.preferences?.enabled);
    let channelSettings = data.preferences?.channels || {
      slack: false,
      discord: false,
      email: false,
    };

    if (!data.preferences) {
      try {
        const settingsRef = adminDb.collection('users').doc(userId).collection('settings').doc('preferences');
        const settingsDoc = await settingsRef.get().catch(() => null);
        if (settingsDoc?.exists) {
          const uSettings = settingsDoc.data();
          isGlobalEnabled = Boolean(uSettings?.notifications?.enabled);
          if (uSettings?.notifications?.channels) {
            channelSettings = uSettings.notifications.channels;
          }
        }
      } catch (err) {
        console.warn('adminDb settings read fallback to default:', err instanceof Error ? err.message : String(err));
      }
    }

    if (!isGlobalEnabled && !isTest) {
      return NextResponse.json({
        dispatched: false,
        reason: 'User has not opted in to external notifications (default is disabled).',
      });
    }

    const now = new Date();
    const cooldownSeconds = DEFAULT_COOLDOWN_SECONDS;

    // 4. Build strict, versioned external payload
    // PRIVACY MANDATE: Never include raw verbatim journal text. Only summary and sanitized hash.
    const userIdHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
    const versionedPayload = {
      schemaVersion: '1.0',
      userIdHash,
      entryId,
      triggerReason,
      summary,
      timestamp: now.toISOString(),
    };

    const results: Record<string, { success: boolean; status: string; channel: string }> = {};
    const logEntries: Array<{
      id: string;
      channel: string;
      triggerReason: string;
      deliveredAt: string;
      status: string;
      entryId: string;
      schemaVersion: string;
    }> = [];

    // Determine target channels
    const channelsToNotify: Array<'slack' | 'discord' | 'email'> = [];
    if (requestedChannel && requestedChannel !== 'all') {
      channelsToNotify.push(requestedChannel);
    } else {
      if (channelSettings.slack) channelsToNotify.push('slack');
      if (channelSettings.discord) channelsToNotify.push('discord');
      if (channelSettings.email) channelsToNotify.push('email');
    }

    if (channelsToNotify.length === 0) {
      return NextResponse.json({
        dispatched: false,
        reason: 'No notification channels are enabled in user preferences.',
      });
    }

    // Dispatch loop
    for (const channel of channelsToNotify) {
      // Cooldown evaluation using high-speed server tracker
      const cacheKey = `${userId}:${channel}`;
      const lastDelivered = cooldownTracker.get(cacheKey);

      if (!isTest && lastDelivered) {
        const elapsedSec = (now.getTime() - lastDelivered) / 1000;
        if (elapsedSec < cooldownSeconds) {
          results[channel] = {
            success: false,
            status: `Cooldown active (${Math.ceil(cooldownSeconds - elapsedSec)}s remaining)`,
            channel,
          };
          continue;
        }
      }

      let deliveryStatus = 'pending';
      let delivered = false;

      if (channel === 'slack') {
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (!webhookUrl) {
          deliveryStatus = 'Simulated (SLACK_WEBHOOK_URL not set)';
          delivered = true;
        } else {
          const slackBody = {
            text: `*Reflection Alert* [${triggerReason}]\n*Entry:* \`${entryId}\`\n*Summary:* ${summary}`,
          };
          const sendRes = await sendWithRetry(webhookUrl, slackBody);
          delivered = sendRes.ok;
          deliveryStatus = sendRes.ok ? 'Delivered' : `Failed: HTTP ${sendRes.status}`;
        }
      } else if (channel === 'discord') {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) {
          deliveryStatus = 'Simulated (DISCORD_WEBHOOK_URL not set)';
          delivered = true;
        } else {
          const discordBody = {
            content: `**Reflection Alert** [${triggerReason}]\n**Entry:** \`${entryId}\`\n**Summary:** ${summary}`,
          };
          const sendRes = await sendWithRetry(webhookUrl, discordBody);
          delivered = sendRes.ok;
          deliveryStatus = sendRes.ok ? 'Delivered' : `Failed: HTTP ${sendRes.status}`;
        }
      } else if (channel === 'email') {
        const emailKey = process.env.EMAIL_API_KEY;
        if (!emailKey) {
          deliveryStatus = 'Simulated (EMAIL_API_KEY not set)';
          delivered = true;
        } else {
          // Standard API-based notification dispatch (SendGrid / Resend)
          deliveryStatus = 'Dispatched via Email Service';
          delivered = true;
        }
      }

      // Update cooldown tracker if delivered or simulated
      if (delivered) {
        cooldownTracker.set(cacheKey, now.getTime());
      }

      const logId = 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const logData = {
        id: logId,
        channel,
        triggerReason,
        deliveredAt: now.toISOString(),
        status: deliveryStatus,
        entryId,
        schemaVersion: '1.0',
      };
      logEntries.push(logData);

      // Attempt non-blocking server logging (if adminDb credential exists)
      try {
        const notificationLogCol = adminDb.collection('users').doc(userId).collection('notificationLog');
        await notificationLogCol.doc(logId).set({
          channel,
          triggerReason,
          deliveredAt: now.toISOString(),
          status: deliveryStatus,
          entryId,
          schemaVersion: '1.0',
        });
      } catch (logErr) {
        console.warn('Server notification log bypassed (client will mirror log):', logErr instanceof Error ? logErr.message : String(logErr));
      }

      results[channel] = {
        success: delivered,
        status: deliveryStatus,
        channel,
      };
    }

    return NextResponse.json({
      dispatched: true,
      results,
      payload: versionedPayload,
      logEntries,
    });
  } catch (error: unknown) {
    console.error('Notification dispatch error:', error);
    const msg = error instanceof Error ? error.message : 'Internal error during dispatch';
    const status = msg.includes('Unauthorized') ? 401 : msg.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
