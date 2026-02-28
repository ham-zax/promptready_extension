import { describe, expect, it } from 'vitest';
import {
  UNLOCK_SCHEME_VERSION,
  buildUnlockStateFromCode,
  formatUnlockCode,
  verifyUnlockCode,
} from '@/lib/unlock-code';

describe('unlock code verifier', () => {
  it('accepts valid checksum codes and stores only last4 metadata', () => {
    const now = new Date('2026-02-28T01:23:45.000Z');
    const code = formatUnlockCode('PRU1ABCDWXYZ5A91');

    const verification = verifyUnlockCode(code);
    expect(verification.valid).toBe(true);

    const unlockState = buildUnlockStateFromCode(code, now);
    expect(unlockState).toEqual({
      isUnlocked: true,
      unlockCodeLast4: '5A91',
      unlockedAt: '2026-02-28T01:23:45.000Z',
      unlockSchemeVersion: UNLOCK_SCHEME_VERSION,
    });
  });

  it('rejects invalid unlock code checksum', () => {
    const verification = verifyUnlockCode('PRU1-ABCD-WXYZ-0000');

    expect(verification.valid).toBe(false);
    expect(verification.errorCode).toBe('invalid_checksum');
    expect(buildUnlockStateFromCode('PRU1-ABCD-WXYZ-0000')).toBeNull();
  });

  it('normalizes whitespace and separators before verification', () => {
    const verification = verifyUnlockCode('  pru1 abcd wxyz 5a91  ');

    expect(verification.valid).toBe(true);
    expect(verification.normalizedCode).toBe('PRU1-ABCD-WXYZ-5A91');
  });
});
