const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/** Return a shareable client URL. The server address and URL fragments are never included. */
export function invitationUrl(currentUrl: string, code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!CODE_PATTERN.test(normalized)) throw new Error('Ungültiger Lobbycode.');
  const url = new URL(currentUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('lobby', normalized);
  return url.toString();
}

/** Invalid invitation parameters must never trigger a join. */
export function invitationCode(currentUrl: string): string | undefined {
  const values = new URL(currentUrl).searchParams.getAll('lobby');
  if (values.length !== 1) return undefined;
  const code = values[0].trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : undefined;
}
