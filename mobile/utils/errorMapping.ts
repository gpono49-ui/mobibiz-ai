/**
 * Firebase error code to user-friendly message mapping.
 * Do not expose raw Firebase technical errors to end users.
 */

const errorMessages: Record<string, string> = {
  // Authentication errors
  'auth/invalid-email': 'Invalid email address. Please check and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/user-not-found': 'Email address not found. Please sign up first.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/operation-not-allowed': 'Sign up is currently disabled. Please try again later.',
  'auth/too-many-requests': 'Too many failed login attempts. Please try again in a few minutes.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email.',
  'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',

  // Network errors
  'auth/network-request-failed': 'Network error. Please check your internet connection.',
  'auth/popup-blocked': 'Pop-up was blocked. Please allow pop-ups and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',

  // Other errors
  'auth/invalid-api-key': 'Application configuration error. Please contact support.',
  'auth/app-not-authorized': 'Application is not authorized. Please contact support.',
};

/**
 * Convert Firebase error codes to user-friendly messages.
 * Falls back to generic message if error code is unknown.
 */
export function getErrorMessage(error: any): string {
  if (!error) {
    return 'An unknown error occurred. Please try again.';
  }

  // Firebase errors have a 'code' property
  if (error.code) {
    return errorMessages[error.code] || error.code;
  }

  // Standard Error objects
  if (error.message) {
    // Check if it's a Firebase error message (contains 'Firebase:')
    if (error.message.includes('Firebase:')) {
      return 'An error occurred. Please try again or contact support.';
    }
    return error.message;
  }

  return 'An unknown error occurred. Please try again.';
}
