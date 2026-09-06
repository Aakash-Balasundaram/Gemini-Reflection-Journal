import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, error: 'Malformed request JSON' }, { status: 400 });
  }

  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';

  if (!apiKey) {
    return NextResponse.json({ valid: false, error: 'API key string is required.' }, { status: 400 });
  }

  if (apiKey.length < 20) {
    return NextResponse.json({ valid: false, error: 'API key appears too short or invalid.' }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: 'Respond with the single word: "VALID"',
    });

    const text = res.text?.trim() || '';
    return NextResponse.json({
      valid: true,
      model: 'gemini-3.6-flash',
      sampleOutput: text,
      message: 'Gemini API key is active and responding successfully.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    let userMsg = 'API key validation failed.';
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
      userMsg = 'API key is invalid. Please verify the key from Google AI Studio.';
    } else if (msg.includes('reported as leaked')) {
      userMsg = 'This key was reported as leaked by Google security and blocked.';
    } else if (msg.includes('PERMISSION_DENIED')) {
      userMsg = 'Permission denied: the key does not have access to Generative Language API.';
    } else {
      userMsg = msg;
    }
    return NextResponse.json({ valid: false, error: userMsg }, { status: 400 });
  }
}
