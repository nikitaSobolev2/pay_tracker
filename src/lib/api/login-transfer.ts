export type LoginTransferDto = {
  readonly code: string;
  readonly token: string;
  readonly authUrl: string;
  readonly expiresAt: string;
};

/** Load the active login code (reuses until expired or redeemed). */
export async function getLoginTransferRequest(
  locale: string,
): Promise<LoginTransferDto> {
  const response = await fetch(
    `/api/devices/login-transfer?locale=${encodeURIComponent(locale)}`,
    { method: "GET" },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message ?? "Failed to load login code");
  }
  return (await response.json()) as LoginTransferDto;
}

/** Force a new login code (refresh / after expiry). */
export async function createLoginTransferRequest(
  locale: string,
): Promise<LoginTransferDto> {
  const response = await fetch("/api/devices/login-transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message ?? "Failed to create login code");
  }
  return (await response.json()) as LoginTransferDto;
}

/**
 * Claim a code/QR. Instead of an instant session this now returns an approval
 * token: the code owner must approve before the device can redeem a session.
 */
export async function redeemLoginTransferRequest(input: {
  readonly code?: string;
  readonly token?: string;
  readonly locale: string;
}): Promise<{ token: string }> {
  const response = await fetch("/api/auth/login-transfer/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  const payload = (await response.json().catch(() => null)) as {
    token?: string;
    message?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.token) {
    throw new Error(
      payload?.message ??
        payload?.error?.message ??
        "Invalid or expired login code",
    );
  }
  return { token: payload.token };
}
