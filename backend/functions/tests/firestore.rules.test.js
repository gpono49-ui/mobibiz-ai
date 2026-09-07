const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

(async () => {
  // Load rules from repository file
  const rules = fs.readFileSync('backend/firestore.rules', 'utf8');

  const projectId = 'mobibiz-test';
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  try {
    // Authenticated user context
    const aliceAuth = { uid: 'user_alice', email: 'alice@example.com' };
    const alice = testEnv.authenticatedContext(aliceAuth.uid, aliceAuth).firestore();

    // Unauthenticated context
    const anon = testEnv.unauthenticatedContext().firestore();

    // 1) Authenticated user can create their own user doc
    await assertSucceeds(alice.doc('users/user_alice').set({ uid: 'user_alice', email: 'alice@example.com' }));

    // 2) Authenticated user SHOULD NOT be able to create admins/owner (client-side)
    await assertFails(alice.doc('admins/owner').set({ uid: 'user_alice' }));

    // 3) Unauthenticated user cannot write users
    await assertFails(anon.doc('users/anon').set({}));

    // 4) Authenticated user cannot write subscriptions (writes must be server-side)
    await assertFails(alice.doc('subscriptions/user_alice').set({ userId: 'user_alice', status: 'active' }));

    console.log('Security rules tests executed: assertions performed (see pass/fail outputs above).');
  } finally {
    await testEnv.cleanup();
  }
})();
