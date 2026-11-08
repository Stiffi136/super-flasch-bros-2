import { describe, expect, it } from 'vitest';
import { invitationCode, invitationUrl } from './invitation';

describe('lobby invitations', () => {
  it('keeps the client path and includes only the lobby code', () => {
    expect(invitationUrl('https://example.com/game/?server=secret#start', 'abC234')).toBe('https://example.com/game/?lobby=ABC234');
  });
  it('accepts valid codes and rejects invalid or repeated parameters', () => {
    expect(invitationCode('https://example.com/game/?lobby=abc234')).toBe('ABC234');
    expect(invitationCode('https://example.com/?lobby=ABC234&lobby=DEF234')).toBeUndefined();
    expect(invitationCode('https://example.com/?lobby=BAD0O1')).toBeUndefined();
    expect(invitationCode('https://example.com/')).toBeUndefined();
    expect(() => invitationUrl('https://example.com/', 'BAD0O1')).toThrow();
  });
});
