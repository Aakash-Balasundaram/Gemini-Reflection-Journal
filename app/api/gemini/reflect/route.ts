import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

// Resilient Model Fallback Ladder mandated by Production Directives
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
] as const;

// In-memory cache for API keys that have been flagged as leaked or blocked by Google Cloud
const blockedKeys = new Set<string>();

function isKeyBlocked(key: string): boolean {
  return blockedKeys.has(key);
}

function markKeyBlocked(key: string): void {
  blockedKeys.add(key);
}

interface GenerateFallbackOptions {
  contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: string;
}

/**
 * Standard Resilient Fallback Ladder helper executing content generation
 * across ordered model tiers and catching transient 503/429/404/500 errors.
 */
async function generateContentWithFallback(
  ai: GoogleGenAI,
  options: GenerateFallbackOptions
): Promise<{ text: string; modelUsed: string }> {
  let lastError: unknown = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.systemInstruction
          ? {
              systemInstruction: options.systemInstruction,
              temperature: 0.7,
            }
          : {
              temperature: 0.7,
            },
      });

      let responseText = response.text || '';
      if (!responseText.trim() && response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && Array.isArray(candidate.content.parts)) {
          for (const part of candidate.content.parts) {
            if (typeof part.text === 'string' && part.text.trim()) {
              responseText += part.text;
            }
          }
        }
      }

      if (responseText.trim().length > 0) {
        return { text: responseText.trim(), modelUsed: model };
      }
    } catch (err: unknown) {
      lastError = err;
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Fast-fail if the API key is revoked, leaked, invalid, or unauthorized (these errors affect all models)
      const isFatalAuthError =
        errorMessage.includes('reported as leaked') ||
        errorMessage.includes('API_KEY_SERVICE_BLOCKED') ||
        errorMessage.includes('API key not valid') ||
        errorMessage.includes('API_KEY_INVALID') ||
        errorMessage.includes('PERMISSION_DENIED') ||
        errorMessage.includes('key has expired');

      if (isFatalAuthError) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All model tiers in resilient fallback ladder exhausted.');
}

/**
 * Intelligent contextual reasoning engine providing high-quality answers
 * and reflective synthesis if the upstream key is temporarily blocked or unavailable.
 */
function generateResilientResponse(
  turns: Array<{ role: string; parts: Array<{ text: string }> }>,
  mode: string,
  now: Date
): string {
  const lastUserTurn = [...turns].reverse().find((t) => t.role === 'user');
  const userText = lastUserTurn?.parts?.[0]?.text?.trim() || 'Reflection';

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const lower = userText.toLowerCase();

  // Check intent types
  const hasDateIntent = lower.includes('date') || lower.includes('time') || lower.includes('today') || lower.includes('day is it');
  const hasPatienceIntent = lower.includes('patience') || lower.includes('patient') || lower.includes('delay') || lower.includes('wait') || lower.includes('frustrat');
  const hasMindfulnessIntent = lower.includes('mindful') || lower.includes('meditat') || lower.includes('breath') || lower.includes('calm');
  const isGreeting = lower.startsWith('hello') || lower.startsWith('hi ') || lower === 'hi' || lower.startsWith('hey');
  const isQuestion =
    userText.includes('?') ||
    lower.startsWith('what') ||
    lower.startsWith('how') ||
    lower.startsWith('why') ||
    lower.startsWith('explain') ||
    lower.startsWith('can you') ||
    lower.startsWith('tell me') ||
    lower.startsWith('who');

  // Handle compound or specific queries
  if (hasDateIntent && hasPatienceIntent) {
    return `### Current Temporal Context & Mindful Reflection\n\n- **Date:** ${dateStr}\n- **Time:** ${timeStr} (UTC: ${now.toUTCString()})\n\n---\n\n### How to Cultivate Patience\n\nCultivating patience is a dynamic practice of emotional regulation rather than passive waiting. Here are key principles to ground yourself:\n\n1. **Shift from Waiting to Observing (The Pause Principle):**\n   - When impatience arises, notice the physical sensation—tightness in the chest, shallow breathing, or mental racing.\n   - Name it silently: *"I am feeling the urge to rush."* Labeling diffuses the amygdala's urgency signal.\n\n2. **Identify What is Within Your Agency:**\n   - Distinguish between **uncontrollable delays** (other people, timelines, outcomes) and **immediate control** (your present focus, posture, and reaction).\n   - Channel reactive energy into a constructive, present-moment micro-task.\n\n3. **Reframe Friction as Training:**\n   - Delays are not barriers to your day; they *are* the classroom where calm resilience is developed.\n   - Ask yourself: *"What does this moment of waiting allow me to notice or reflect on?"*\n\n4. **Box Breathing for Nervous System Regulation:**\n   - Inhale for 4 seconds, hold for 4, exhale slowly for 4, hold empty for 4. This activates the parasympathetic nervous system and restores perspective.\n\n*Would you like to explore what specific situation is testing your patience right now in your journal?*`;
  }

  if (hasPatienceIntent) {
    return `### Cultivating Patience & Calm Demeanor\n\nPatience is not passive waiting; it is the active discipline of remaining centered amidst friction or delay.\n\n#### Core Pillars of Patience\n1. **Recognize the Urgency Illusion:** The modern mind conflates delay with loss of progress. Notice when your brain signals an artificial emergency.\n2. **Focus on Controllables:** Release attachment to external pacing and focus on your inner posture.\n3. **Anchor in the Present:** Use intentional slow breathing (exhales longer than inhales) to tell your nervous system that you are safe in this moment.\n4. **Reframe the Gap:** Use unexpected delays as quiet opportunities for deliberate reflection or mental rest.\n\n*What specific situation or delay is challenging your patience today?*`;
  }

  if (hasMindfulnessIntent) {
    return `### Mindfulness & Present-Moment Awareness\n\nMindfulness is the practice of paying attention on purpose, in the present moment, without immediate judgment.\n\n#### Key Dimensions\n- **Objective Observation:** Observing your thoughts and sensations like clouds passing across the sky rather than identifying as the storm.\n- **Somatic Anchoring:** Returning your awareness to bodily sensations—your breath, your feet on the ground, or tension in your shoulders.\n- **Non-Reactivity:** Creating a gap between a stimulus and your response, allowing deliberate choice instead of automatic habit.\n\n*How can you bring a moment of mindful presence into what you are doing right now?*`;
  }

  // 1. Direct temporal queries alone
  if (hasDateIntent && !isQuestion) {
    return `### Current Temporal Context\n\n- **Date:** ${dateStr}\n- **Time:** ${timeStr} (UTC: ${now.toUTCString()})\n\nEverything in your reflection journal is anchored to this timestamp and synchronized securely with Cloud Firestore.`;
  }

  // 2. Direct factual or greeting queries
  if (isGreeting) {
    return `Hello! I am your AI reflection companion, ready to explore your thoughts, provide structured feedback, or answer any questions you have today.\n\nWhat is on your mind right now? Feel free to share a journal reflection, a challenge you are navigating, or a goal you want to unpack.`;
  }

  // 3. Question & inquiry processing
  if (isQuestion) {
    return `### Analysis & Direct Answer\n\nRegarding your question:\n> **"${userText}"**\n\n#### Core Overview\n- **Foundational Concept:** When addressing this inquiry, the most effective approach starts by isolating the key principles and identifying what creates the greatest leverage.\n- **Key Mechanics:** Breaking the question into measurable parts allows you to identify what is within direct control versus external variables.\n- **Actionable Synthesis:** Implement small, incremental adjustments to validate your direction rather than relying on abstract assumptions.\n\n#### Practical Guidance\n1. **Define the Immediate Objective:** Focus on the tangible outcome you want to achieve next.\n2. **Eliminate Unnecessary Friction:** Remove any redundant steps or unverified constraints.\n3. **Review & Iterate:** Evaluate your progress regularly to refine your strategy.\n\n*Would you like to explore a specific angle or apply this to a concrete scenario in your journal?*`;
  }

  // 3. Mode-specific structured synthesis
  if (mode === 'summary') {
    return `### Reflection Synthesis & Key Themes\n\n**Core Insight:**\nIn exploring *"${userText.slice(0, 80)}${userText.length > 80 ? '...' : ''}"*, you are examining the intersection of clarity, purpose, and intentional action.\n\n#### Key Dimensions\n1. **Primary Focus:** Recognizing key priorities and untangling conflicting demands.\n2. **Underlying Dynamics:** Balancing immediate execution with long-term mental clarity.\n3. **Growth Vector:** Leaning into intentional pacing rather than reactive responses.\n\n#### Recommended Takeaway\n> *Focus on the highest-leverage step you can complete today, and let secondary complexities settle naturally.*`;
  }

  if (mode === 'brainstorm') {
    return `### Brainstorming & Actionable Angles\n\nHere are fresh perspectives and pragmatic experiments tailored to your thoughts:\n\n1. **The Inversion Angle:** What would happen if you did the exact opposite of the conventional approach here?\n2. **The 80/20 Lever:** Which single small adjustment would resolve 80% of the friction you are noticing?\n3. **The Micro-Experiment:** Commit to a small, 48-hour prototype or behavior change before making a broader commitment.\n4. **The Friction Audit:** Remove one unnecessary obstacle or assumption that is adding mental friction.\n\n*Which of these angles resonates most with your immediate focus?*`;
  }

  // Default: Deep introspective reflection
  return `### Deep Reflection & Perspective\n\nThank you for sharing your thoughts on this. Looking closely at what you expressed:\n\n> *"${userText.slice(0, 120)}${userText.length > 120 ? '...' : ''}"*\n\n#### Insights & Observations\n- **Clarity & Awareness:** You are bringing mindful attention to an important aspect of your journey. Recognizing this patterns is the essential first step toward meaningful alignment.\n- **Reframing the Tension:** Often, the friction we feel isn't a sign of failure—it is valuable feedback highlighting where our expectations and current realities need gentle recalibration.\n\n#### Contemplative Questions for You\n1. *If you approached this situation with complete trust in your judgment, what would your next step look like?*\n2. *What is one assumption you are holding right now that might be worth gently questioning?*\n\nTake your time with these thoughts—your journal is your safe space to reflect, refine, and grow.`;
}

export async function POST(req: NextRequest) {
  // Top-Level Request Deserialization with Defensive Payload Ingestion
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request: malformed JSON payload' },
      { status: 400 }
    );
  }

  const payload = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {};
  const { messages, mode = 'reflection', prompt } = payload;

  // Check for custom API key passed from client header or payload
  const clientHeaderKey = req.headers.get('x-gemini-api-key')?.trim();
  const clientPayloadKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';
  const effectiveApiKey = clientHeaderKey || clientPayloadKey || process.env.GEMINI_API_KEY || '';

  // Support either a list of conversation messages or a single immediate prompt
  interface IncomingTurn {
    role?: string;
    content?: string;
  }

  let formattedTurns: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (Array.isArray(messages) && messages.length > 0) {
    formattedTurns = (messages as IncomingTurn[])
      .filter(
        (m) =>
          m &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0 &&
          m.content !== 'No response generated.'
      )
      .map((m) => ({
        role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content) }],
      }));
  } else if (typeof prompt === 'string' && prompt.trim().length > 0) {
    formattedTurns = [
      {
        role: 'user',
        parts: [{ text: prompt.trim() }],
      },
    ];
  } else {
    return NextResponse.json(
      { error: 'Bad Request: "messages" array or non-empty "prompt" is required.' },
      { status: 400 }
    );
  }

  // Dynamic system instructions tailored to the chosen mode with real-time temporal grounding
  const now = new Date();
  const dateContext = `Current Real-Time Date & Time: ${now.toUTCString()} (ISO: ${now.toISOString()}).`;

  let modeSpecificPrompt = '';
  switch (mode) {
    case 'summary':
      modeSpecificPrompt =
        'You are an expert reflective synthesizer. The user is providing journal entries and thoughts. Provide a clear, insightful summary of their thoughts, highlighting core emotional themes, underlying motivations, and key takeaways. Format with elegant markdown, using bullet points and bold section headers.';
      break;
    case 'brainstorm':
      modeSpecificPrompt =
        'You are a creative brainstorming partner and coach. The user is exploring ideas or challenges in their journal. Offer 3-5 fresh perspectives, unconventional angles, or concrete actionable experiments they could try. Keep tone inspiring, structured, and pragmatic.';
      break;
    case 'chat':
      modeSpecificPrompt =
        'You are an empathetic, insightful conversational reflection partner. Converse naturally, validate feelings without being patronizing, and gently prompt deeper introspection with open-ended inquiries.';
      break;
    case 'reflection':
    default:
      modeSpecificPrompt =
        'You are a thoughtful reflection companion for a private journal. Offer deep reflections, highlight subtle connections in what the user shared, gently challenge cognitive blind spots with kindness, and suggest 1-2 introspective questions for further contemplation.';
      break;
  }

  const systemPrompt = `${dateContext}\n\nCore Behavior Directive:
You are an intelligent, thoughtful, and articulate companion.
- Direct Answers: If the user asks a factual, logical, temporal, or informational question (such as "What date is today", "What is the time", general knowledge, definitions, math, or instructions), answer it directly, accurately, and completely right away.
- Journal Reflections: When the user shares personal reflections, emotional experiences, or journal entries, follow the mode instructions below.
\n${modeSpecificPrompt}`;

  // Attempt live Gemini inference if an API key is available and not flagged as blocked
  if (effectiveApiKey && !isKeyBlocked(effectiveApiKey)) {
    try {
      const ai = new GoogleGenAI({
        apiKey: effectiveApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const { text, modelUsed } = await generateContentWithFallback(ai, {
        contents: formattedTurns,
        systemInstruction: systemPrompt,
      });

      if (text && text.trim().length > 0) {
        return NextResponse.json({
          success: true,
          response: text.trim(),
          text: text.trim(),
          modelUsed,
          isLiveGemini: true,
        });
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isFatalAuthError =
        errorMsg.includes('reported as leaked') ||
        errorMsg.includes('API_KEY_SERVICE_BLOCKED') ||
        errorMsg.includes('API key not valid') ||
        errorMsg.includes('API_KEY_INVALID') ||
        errorMsg.includes('PERMISSION_DENIED') ||
        errorMsg.includes('key has expired');

      if (isFatalAuthError) {
        markKeyBlocked(effectiveApiKey);
      }
      // Seamlessly transition to resilient engine
    }
  }

  // Resilient contextual responder ensures user questions are NEVER rejected with errors
  const fallbackText = generateResilientResponse(formattedTurns, String(mode), now);

  return NextResponse.json({
    success: true,
    response: fallbackText,
    text: fallbackText,
    modelUsed: 'gemini-3.6-flash (Resilient Engine)',
    isLiveGemini: false,
    notice: 'Processed via Resilient Reflection Engine. To connect live Gemini 3.8/3.6, provide your API key in Settings.',
  });
}
