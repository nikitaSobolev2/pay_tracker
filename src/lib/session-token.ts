/**
 * Extract raw Bearer credentials from an Authorization header.
 */
export function parseBearerToken(
  authorizationHeader: string | null,
): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

/**
 * Better Auth signed cookies look like `token.signature`. Native clients may
 * send either the signed `set-auth-token` value or the raw session token.
 */
export function sessionTokenCandidates(token: string): string[] {
  const decoded = (() => {
    try {
      return decodeURIComponent(token);
    } catch {
      return token;
    }
  })();
  const candidates = [decoded, token];
  const dotIndex = decoded.indexOf(".");
  if (dotIndex > 0) {
    candidates.push(decoded.slice(0, dotIndex));
  }
  return [...new Set(candidates.filter(Boolean))];
}
