/**
 * Temporary passwords for new accounts and resets.
 *
 * Generated in the browser from crypto.getRandomValues, never on a
 * predictable seed, and shown once. The alphabet omits the characters
 * people misread when a password is written on paper and carried down a
 * corridor: no I, l, 1, O or 0.
 *
 * Sixteen characters comfortably clears the twelve the API requires.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function suggestPassword(length = 16): string {
  const draws = crypto.getRandomValues(new Uint32Array(length));
  return [...draws].map((n) => ALPHABET[n % ALPHABET.length]).join('');
}
