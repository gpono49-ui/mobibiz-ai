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
  const business = businessSnap.empty ? null : businessSnap.docs[0].data();

  // If Gemini key not configured, return a clear error rather than a fake response
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
  }

  // Use @google-cloud/generative-ai if available
  try {
    // Lazy import to avoid runtime errors if dependency missing
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {TextServiceClient} = require('@google-cloud/generative-ai');
    const client = new TextServiceClient({ apiKey: geminiKey });

    // Create a light context using the user's data
    const contextText = business ? `Business: ${business.name || 'N/A'}; Owner: ${business.ownerName || 'N/A'}` : 'No business data';

    // NOTE: exact client usage may require configuration; this is a minimal call pattern
    const request = {
      model: 'text-bison-001',
      prompt: {
        text: `Context: ${contextText}\n\nUser prompt: ${prompt}`,
      },
      maxOutputTokens: 512,
    } as any;

    const [response] = await client.generateText(request);
    const text = response?.candidates?.[0]?.content || null;
    if (!text) {
      throw new functions.https.HttpsError('internal', 'Empty response from Gemini');
    }

    return { text };
  } catch (err: any) {
    console.error('AI error', err);
    throw new functions.https.HttpsError('internal', 'AI request failed: ' + (err.message || String(err)));
  }
});
