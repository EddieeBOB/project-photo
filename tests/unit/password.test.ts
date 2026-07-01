import { describe, it, expect } from 'vitest';
import { isPasswordValid, PASSWORD_RULES } from '../../src/utils/password';

describe('password rules', () => {
    it('rejects an empty password', () => {
        expect(isPasswordValid('')).toBe(false);
    });

    it('rejects a password missing each individual requirement', () => {
        // base satisfies everything; we knock out one class at a time
        expect(isPasswordValid('short1A!')).toBe(true); // sanity: 8 chars, all classes
        expect(isPasswordValid('NOLOWER1!')).toBe(false);   // no lowercase
        expect(isPasswordValid('nolower1!')).toBe(false);   // no uppercase
        expect(isPasswordValid('NoNumber!!')).toBe(false);  // no number
        expect(isPasswordValid('NoSpecial1')).toBe(false);  // no special char
        expect(isPasswordValid('Ab1!')).toBe(false);        // too short
    });

    it('accepts a password meeting every requirement', () => {
        expect(isPasswordValid('Str0ng!Pass')).toBe(true);
        expect(isPasswordValid('aB3$aB3$')).toBe(true);
    });

    it('treats whitespace and unicode as valid special characters', () => {
        expect(PASSWORD_RULES.find((r) => r.key === 'special')!.test('abcABC12 ')).toBe(true);
        expect(PASSWORD_RULES.find((r) => r.key === 'special')!.test('abcABC12€')).toBe(true);
    });

    it('exposes a label for every rule', () => {
        for (const rule of PASSWORD_RULES) {
            expect(rule.label.length).toBeGreaterThan(0);
        }
    });
});
