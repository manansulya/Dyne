/**
 * The user the mocked NextAuth session resolves to. Integration tests flip this
 * to act as a different account; `null` means "not signed in", which is how the
 * 401 paths are exercised.
 */
export const currentSession: { userId: string | null } = { userId: null };

export function actAs(userId: string | null) {
  currentSession.userId = userId;
}
