# Gemini Reflection Journal with Cloud Firestore

A secure, user-authenticated journaling and thought partnership application built with Next.js, Gemini 3.6 Flash API, Firebase Authentication (Google Sign-In), and Cloud Firestore with owner-bound user isolation.

---

## 1. Architecture & Threat Model Summary

| Threat Zone | Identified Risks | Countermeasures Implemented |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious injection payloads, fabricated GPS coordinates | Defensive schema validation; Google Maps Places API resolution on server only; Firestore rejects `source != "google_places"`. |
| **Planning & Reasoning** | Prompt injection attempting to hijack model behavior | Strict system instructions treating journal entries as passive data; isolated context boundaries. |
| **Tool Execution / API** | Credential leakage or privilege escalation | Dual Google Maps API keys (browser vs server); server-side Gemini API proxy (`/api/gemini/reflect`) with resilient fallback ladder. |
| **Memory & State** | Cross-tenant data leaks & role tampering | Cloud Firestore owner-bound security rules; cryptographic Firebase Auth custom claims for RBAC; immutable `/adminAuditLogs`. |
| **Inter-System Communication** | Webhook token theft & journal leakage | Webhook secrets in Secret Manager; 300s per-user rate-limiting cooldown; privacy payload sends only short AI summaries, never raw text. |

---

## 2. Security Directives & Trust Boundaries

### Directive 1: Location-Aware Entries (Google Maps)
- **Dual API Key Isolation**:
  - `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`: Restricted by HTTP referrer to production/staging domains; enabled only for Maps JavaScript & Places API (New).
  - `GOOGLE_MAPS_SERVER_KEY`: Stored in Secret Manager / server environment; restricted by server IP address; used only in `/api/locations/resolve`.
- **Untrusted Input Protection**:
  - Browser passes only `placeId` and `sessionToken`. Server resolves canonical coordinates and address.
  - Firestore Security Rule strictly rejects any interaction write where `location.source != "google_places"`.

### Directive 2: Admin Dashboard & RBAC
- **Cryptographic Custom Claims**:
  - Roles (`admin`, `moderator`, `user`) are stored in Firebase Auth JWT custom claims, never in client-writable Firestore documents.
  - Every privileged API route (`/api/admin/*`) executes `adminAuth.verifyIdToken(token)` to inspect server-controlled state.
- **Audit Logging**:
  - Every role modification records an immutable log entry in `/adminAuditLogs`, which is write-only via the Admin SDK and read-only for verified admins.

### Directive 3: External Notifications (Slack, Discord, Email)
- **Zero Raw Text Leakage**:
  - Webhook payloads (Schema v1.0) contain only an anonymous SHA-256 hash of the UID and a brief Gemini-synthesized summary (≤280 chars). Verbatim reflections are never transmitted.
- **Server-Side Cooldown**:
  - A strict 300-second cooldown is enforced server-side against `/users/{userId}/notificationSettings/cooldown` to eliminate webhook abuse.
- **Opt-In Default**:
  - Notifications are disabled by default until explicitly enabled by the user in their settings.

---

## 2. Prerequisites & Cloud Setup

### 2.1 Google Cloud SDK & API Activation
Enable the required Google Cloud services:
```bash
# Set project ID
export PROJECT_ID="YOUR_PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

### 2.2 Secret Management Setup
Store the Gemini API Key securely in Secret Manager and grant Cloud Run compute permissions:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Obtain project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Cloud Firestore Security Configuration

Ensure user isolation by deploying the owner-bound security rules:

### `firestore.rules`
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /reflections/{reflectionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Deploy rules using Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Google Cloud Run Deployment Flow

Deploy the containerized Next.js application to Cloud Run with mounted secrets:

```bash
# Build and deploy to Cloud Run
gcloud run deploy gemini-reflection-journal \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

### Campaign Verification Labeling
Apply the mandatory campaign label for automated challenge verification:

```bash
gcloud run services update gemini-reflection-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 5. Functional Stability & Walkthrough Test Suite

This section outlines test procedures for every user-visible process and interaction in the application.

### Test Case 1: Google Federated Authentication
- **Action**: Click `#landing-signin-btn` or `#google-signin-btn`.
- **Expected Outcome**:
  - Google Sign-In popup opens with account chooser.
  - Upon sign-in, user profile pill appears in the top navigation bar with avatar, name, and email.
  - Application transitions immediately from `LandingView` to `Dashboard`.
  - No email or password form is presented or stored.

### Test Case 2: Multi-Turn Journal Reflection
- **Action**:
  1. Click an inspiration starter prompt or type custom thoughts into `#journal-input`.
  2. Click `#send-reflection-btn` or press `Cmd+Enter`.
- **Expected Outcome**:
  - Button switches to active spinner: *"Gemini 3.6 Flash is synthesizing insights..."*.
  - User turn appears in `#turns-container` with avatar and timestamp.
  - Gemini 3.6 Flash responds in markdown with reflective analysis and introspective follow-up questions.
  - Input field clears cleanly only upon successful response.

### Test Case 3: Mode Switching (Summary & Brainstorming)
- **Action**:
  1. Click the *"Summary"* or *"Ideas"* pill in `#mode-selector`.
  2. Enter a new reflection or prompt (e.g. *"Summarize my last 3 thoughts"*).
  3. Submit the turn.
- **Expected Outcome**:
  - Server routes to `POST /api/gemini/reflect` with mode parameter set.
  - Gemini formats output with markdown headers, bold summaries, or bulleted brainstorming experiments.
  - Mode badge updates in real-time in the sidebar.

### Test Case 4: Cloud Firestore Persistence & User Isolation
- **Action**:
  1. Enter and send reflections in a session.
  2. Open browser DevTools Network tab and verify Firestore document write to `/users/{uid}/interactions/{docId}`.
  3. Verify all undefined fields are stripped via `stripUndefined`.
  4. Reload the page or log in on another device with the same Google account.
- **Expected Outcome**:
  - Real-time snapshot listener restores the full conversation history, title, and timestamps in `#history-panel`.
  - Another user logged in with a different Google account cannot query or view these documents (HTTP 403 / permission denied enforced by Firestore security rules).

### Test Case 5: History Search & Filtering
- **Action**:
  1. Enter text in `#search-history-input`.
  2. Click mode filter tabs (*"Reflect"*, *"Summary"*, *"Ideas"*, *"Chat"*).
- **Expected Outcome**:
  - History list filters dynamically in real-time matching either title or transcript content.
  - Matching items remain clickable to load into the active canvas.

### Test Case 6: Guaranteed Transaction Verification & Error Recovery
- **Action**:
  1. Simulate API or network interruption while submitting a turn.
- **Expected Outcome**:
  - Error banner (`#retry-save-banner`) displays the exact error message.
  - User's input text is **retained** without clearing the buffer.
  - *"Retry"* button appears, allowing seamless re-submission without retyping.

### Test Case 7: Session Deletion & Sign Out
- **Action**:
  1. Hover an entry in `#history-panel` and click the trash can button (`#delete-entry-btn-{id}`).
  2. Confirm deletion prompt.
  3. Click `#signout-btn`.
- **Expected Outcome**:
  - Document is removed from Firestore; UI updates immediately.
  - User is signed out, cache is cleared, and application returns to `#landing-signin-btn`.

### Test Case 8: Location-Aware Tagging & Security Rule Validation
- **Action**:
  1. In `#journal-canvas`, click *"Add Location"* (`#tag-location-btn`).
  2. Type a place search term in `#place-search-input` (e.g., *"San Francisco Ferry Building"*).
  3. Select an item from the autocomplete dropdown.
  4. Submit the journal entry to Firestore.
  5. Attempt to forge a Firestore write where `location.source = "browser_gps"`.
- **Expected Outcome**:
  - Selected place resolves canonical address and coordinates via `/api/locations/resolve` using the server-side key.
  - Green *"Verified"* badge with location address appears in the editor canvas.
  - Upon save, the interaction document in `/users/{userId}/interactions/{id}` stores `{ location: { placeId, formattedAddress, lat, lng, source: "google_places" } }`.
  - Forged write with `source != "google_places"` is rejected by Firestore security rules with permission-denied.
  - In `#history-panel`, the entry item displays the location badge.

### Test Case 9: Admin RBAC & Custom Claims Verification
- **Action**:
  1. Authenticate with an admin account or click *"Bootstrap First Admin"* in the header (`#bootstrap-admin-btn`).
  2. Click *"Admin"* button (`#admin-dashboard-btn`) to open the Admin Dashboard modal.
  3. In the Users tab, view list of users. Change a user's role from `"user"` to `"moderator"`.
  4. Switch to the Audit Log tab.
  5. Attempt an unauthorized direct call to `POST /api/admin/role` with a standard user's bearer token.
- **Expected Outcome**:
  - Admin modal displays users and current custom claim roles.
  - Role update executes `adminAuth.setCustomUserClaims` server-side and writes an immutable record to `/adminAuditLogs`.
  - Audit Log tab displays timestamp, actor UID, target UID, and resulting role change.
  - Unauthorized direct call returns HTTP 403 Forbidden because server verifies custom claim `role === 'admin'`.

### Test Case 10: External Webhook Alerts (Slack/Discord/Email) & Cooldown
- **Action**:
  1. Click the notification bell icon (`#notification-settings-btn`) in the header.
  2. Toggle *"Enable Notifications"* and select channels (e.g., Slack or Discord). Click *"Save Preferences"*.
  3. Click *"Send Test Ping"*.
  4. Immediately click *"Send Test Ping"* again within 300 seconds.
  5. Save a journal entry.
- **Expected Outcome**:
  - First test ping returns HTTP 200 and records a successful delivery in `/users/{userId}/notificationLogs/{id}`.
  - Delivery history table updates showing timestamp, channel, event status, and payload hash.
  - Second test ping within 300s returns HTTP 429 Cooldown Active, displaying the remaining cooldown seconds without hammering the external webhook.
  - Outgoing webhook payload (Schema 1.0) contains only `userIdHash` and Gemini summary, zero raw journal text.
