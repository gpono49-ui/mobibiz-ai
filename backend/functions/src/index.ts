import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Callable function to bootstrap an owner. This must be called by a deploy-time operator
// The caller must provide a secret token (BOOTSTRAP_SECRET) which is compared to process.env.BOOTSTRAP_SECRET
// The function creates the document admins/owner using the Admin SDK (bypasses rules).
export const createOwner = functions.https.onCall(async (data, context) => {
  // Basic auth: require an auth token and secret
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  const provided = data?.secret;
  const expected = process.env.BOOTSTRAP_SECRET;
  if (!expected) {
    throw new functions.https.HttpsError('failed-precondition', 'Bootstrap secret not configured on server');
  }
  if (!provided || provided !== expected) {
    throw new functions.https.HttpsError('permission-denied', 'Invalid bootstrap secret');
  }

  const uid = context.auth.uid;
  const user = context.auth.token.email || null;

  const ownerRef = db.doc('admins/owner');
  const snap = await ownerRef.get();
  if (snap.exists) {
    throw new functions.https.HttpsError('already-exists', 'Owner already provisioned');
  }

  await ownerRef.set({ uid, email: user, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { success: true };
});

// AI Chat callable function
export const aiChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = context.auth.uid;
  const prompt = data?.prompt;
  if (!prompt || typeof prompt !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Prompt is required');
  }

  // Fetch user's business data (scope to single business for now)
  const businessSnap = await db.collection(`users/${uid}/businesses`).limit(1).get();
  const businessDoc = businessSnap.empty ? null : businessSnap.docs[0];
  const business = businessDoc ? businessDoc.data() : null;

  // If Gemini key not configured, return a clear error rather than a fake response
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
  }

  // Calculate simple business facts from Firestore (only reads scoped to this user's data)
  try {
    // Total today's sales and expenses (assumes collections at users/{uid}/sales and users/{uid}/expenses)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const salesQuery = db.collection(`users/${uid}/sales`).where('createdAt', '>=', startOfDay).where('createdAt', '<=', endOfDay);
    const expensesQuery = db.collection(`users/${uid}/expenses`).where('createdAt', '>=', startOfDay).where('createdAt', '<=', endOfDay);

    const [salesSnap, expensesSnap] = await Promise.all([salesQuery.get(), expensesQuery.get()]);

    let todaysSales = 0;
    salesSnap.forEach(doc => {
      const a = doc.data()?.amount;
      if (typeof a === 'number') todaysSales += a;
    });

    let todaysExpenses = 0;
    expensesSnap.forEach(doc => {
      const a = doc.data()?.amount;
      if (typeof a === 'number') todaysExpenses += a;
    });

    const estimatedProfit = todaysSales - todaysExpenses;

    // Debts: sum outstanding customer debts at users/{uid}/debts
    const debtsSnap = await db.collection(`users/${uid}/debts`).get();
    let totalDebts = 0;
    debtsSnap.forEach(doc => {
      const a = doc.data()?.amount;
      const paid = doc.data()?.paid || false;
      if (!paid && typeof a === 'number') totalDebts += a;
    });

    // Build context for Gemini but avoid leaking sensitive fields
    const contextText = business
      ? `Business: ${business.name || 'N/A'}; Owner: ${business.ownerName || 'N/A'}; Today's sales: ${todaysSales}; Today's expenses: ${todaysExpenses}; Estimated profit: ${estimatedProfit}; Total debts: ${totalDebts}`
      : `No business data; Today's sales: ${todaysSales}; Today's expenses: ${todaysExpenses}; Estimated profit: ${estimatedProfit}; Total debts: ${totalDebts}`;

    // Prepare AI prompt
    const aiPrompt = `You are MobiBiz AI: a helpful assistant for small-business owners. Use the factual summary provided separately to answer the user's question.

Factual summary:\n${contextText}\n\nUser question:\n${prompt}\n\nProvide clear suggestions and label them as 'suggestions'. Do not fabricate numeric facts; if data is missing, say so. Return JSON with two top-level keys: "facts" (the computed facts) and "suggestions" (your advice).`;

    // Use @google/genai SDK (server-side only)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Use a currently supported Gemini model. Change if your account exposes a different stable model.
    const model = 'gemini-2.5-flash';

    // Call the canonical generateContent method
    const request = {
      model,
      contents: aiPrompt,
      // optional: set max output tokens if supported by your SDK/account
      // maxOutputTokens: 512,
    } as any;

    const response = await ai.models.generateContent(request);

    // Extract text from canonical response shape
    // Typical shape: { content: '...', candidates: [{ content: '...' }], output: [...] }
    let aiText: string | null = null;
    if (typeof response === 'string') {
      aiText = response;
    } else if (response?.content) {
      aiText = response.content;
    } else if (response?.candidates && response.candidates[0]?.content) {
      aiText = response.candidates[0].content;
    } else if (response?.output && response.output[0] && (response.output[0].content || response.output[0].text)) {
      aiText = response.output[0].content || response.output[0].text;
    } else if (response?.text) {
      aiText = response.text;
    }

    if (!aiText) {
      console.error('AI SDK returned unexpected response:', JSON.stringify(response));
      throw new functions.https.HttpsError('internal', 'Empty response from Gemini');
    }

    // Try to parse JSON from the model output (we asked for JSON {facts,suggestions})
    let parsed: any = null;
    try {
      parsed = JSON.parse(aiText);
    } catch (e) {
      // If parsing fails, return the raw text as suggestions with facts provided separately
      parsed = {
        facts: {
          todaysSales,
          todaysExpenses,
          estimatedProfit,
          totalDebts,
          business: business ? { id: businessDoc?.id || null, name: business.name || null } : null,
        },
        suggestions: aiText,
      };
    }

    // Ensure facts are provided from computed results (do not trust AI numeric claims)
    const result = {
      facts: {
        todaysSales,
        todaysExpenses,
        estimatedProfit,
        totalDebts,
        business: business ? { id: businessDoc?.id || null, name: business.name || null } : null,
      },
      suggestions: parsed?.suggestions || parsed || aiText,
    };

    return result;
  } catch (err: any) {
    console.error('AI error', err);
    throw new functions.https.HttpsError('internal', 'AI request failed: ' + (err.message || String(err)));
  }
});
