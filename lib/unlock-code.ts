import type { ByokUnlockState } from './types';

const UNLOCK_PREFIX = 'PRU1';
const COMPACT_UNLOCK_CODE_LENGTH = 16;

export const UNLOCK_SCHEME_VERSION = 1;

export type UnlockCodeErrorCode =
  | 'invalid_format'
  | 'invalid_prefix'
  | 'invalid_checksum';

export interface UnlockVerificationResult {
  valid: boolean;
  normalizedCode: string | null;
  errorCode: UnlockCodeErrorCode | null;
  unlockCodeLast4: string | null;
  unlockSchemeVersion: number;
}

function compactUnlockCode(rawCode: string): string {
  return (rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function computeUnlockChecksum(payload: string): string {
  let acc = 0;

  for (let i = 0; i < payload.length; i += 1) {
    const charCode = payload.charCodeAt(i);
    acc = (acc + (charCode * (i + 17))) & 0xffff;
  }

  acc = (acc + 0x094A) & 0xffff;
  return acc.toString(16).toUpperCase().padStart(4, '0');
}

export function formatUnlockCode(rawCode: string): string {
  const compact = compactUnlockCode(rawCode);
  if (compact.length !== COMPACT_UNLOCK_CODE_LENGTH) {
    return compact;
  }

  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12)}`;
}

export function verifyUnlockCode(rawCode: string): UnlockVerificationResult {
  const compact = compactUnlockCode(rawCode);

  if (compact.length !== COMPACT_UNLOCK_CODE_LENGTH) {
    return {
      valid: false,
      normalizedCode: null,
      errorCode: 'invalid_format',
      unlockCodeLast4: null,
      unlockSchemeVersion: UNLOCK_SCHEME_VERSION,
    };
  }

  if (!compact.startsWith(UNLOCK_PREFIX)) {
    return {
      valid: false,
      normalizedCode: formatUnlockCode(compact),
      errorCode: 'invalid_prefix',
      unlockCodeLast4: null,
      unlockSchemeVersion: UNLOCK_SCHEME_VERSION,
    };
  }

  const payload = compact.slice(0, 12);
  const providedChecksum = compact.slice(12);
  const expectedChecksum = computeUnlockChecksum(payload);

  if (providedChecksum !== expectedChecksum) {
    return {
      valid: false,
      normalizedCode: formatUnlockCode(compact),
      errorCode: 'invalid_checksum',
      unlockCodeLast4: null,
      unlockSchemeVersion: UNLOCK_SCHEME_VERSION,
    };
  }

  return {
    valid: true,
    normalizedCode: formatUnlockCode(compact),
    errorCode: null,
    unlockCodeLast4: compact.slice(-4),
    unlockSchemeVersion: UNLOCK_SCHEME_VERSION,
  };
}

export function buildUnlockStateFromCode(rawCode: string, now: Date = new Date()): ByokUnlockState | null {
  const verification = verifyUnlockCode(rawCode);
  if (!verification.valid || !verification.unlockCodeLast4) {
    return null;
  }

  return {
    isUnlocked: true,
    unlockCodeLast4: verification.unlockCodeLast4,
    unlockedAt: now.toISOString(),
    unlockSchemeVersion: verification.unlockSchemeVersion,
  };
}
