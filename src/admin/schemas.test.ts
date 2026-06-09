import { describe, expect, it } from 'vitest';
import {
  bufferToHex,
  constantTimeEqual,
  randomHex,
  stripPasswordFields,
  type User,
  validateAvatarUrl,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateRole,
  validateUsername,
} from './schemas';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    username: 'alice',
    displayName: 'Alice',
    email: 'alice@example.com',
    passwordHash: 'hash',
    passwordSalt: 'salt',
    role: 'admin',
    avatarUrl: 'https://example.com/avatar.png',
    createdAt: 1,
    updatedAt: 2,
    banned: false,
    bannedReason: '',
    ...overrides,
  };
}

describe('admin schemas validation', () => {
  it('normalizes valid email values', () => {
    expect(validateEmail('  USER@Example.Com  ')).toBe('user@example.com');
  });

  it('rejects invalid email values', () => {
    expect(validateEmail('not-an-email')).toBeNull();
  });

  it('normalizes valid usernames and rejects invalid ones', () => {
    expect(validateUsername('  Alice_123  ')).toBe('alice_123');
    expect(validateUsername('bad name')).toBeNull();
  });

  it('enforces password constraints', () => {
    expect(validatePassword('12345678')).toBe('12345678');
    expect(validatePassword('short')).toBeNull();
  });

  it('trims display name and rejects empty values', () => {
    expect(validateDisplayName('  Display  ')).toBe('Display');
    expect(validateDisplayName('   ')).toBeNull();
  });

  it('accepts https/data avatar URLs and rejects others', () => {
    expect(validateAvatarUrl('https://example.com/avatar.png')).toBe(
      'https://example.com/avatar.png',
    );
    expect(validateAvatarUrl('data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA',
    );
    expect(validateAvatarUrl('http://example.com/avatar.png')).toBeNull();
  });

  it('validates roles strictly', () => {
    expect(validateRole('owner')).toBe('owner');
    expect(validateRole('superadmin')).toBeNull();
  });
});

describe('admin schemas helpers', () => {
  it('removes password fields from user payloads', () => {
    const safe = stripPasswordFields(makeUser());
    expect(safe).not.toHaveProperty('passwordHash');
    expect(safe).not.toHaveProperty('passwordSalt');
    expect(safe.username).toBe('alice');
  });

  it('generates lowercase hex tokens of expected length', () => {
    const token = randomHex(16);
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('encodes buffers to hex', () => {
    const bytes = new Uint8Array([0, 1, 16, 255]);
    expect(bufferToHex(bytes.buffer)).toBe('000110ff');
  });

  it('compares strings in constant-time style semantics', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true);
    expect(constantTimeEqual('abc123', 'abc124')).toBe(false);
    expect(constantTimeEqual('short', 'longer')).toBe(false);
  });
});
