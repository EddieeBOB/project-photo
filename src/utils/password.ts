export interface PasswordRule {
    key: string;
    label: string;
    test: (pw: string) => boolean;
}

/** Password requirements enforced on signup and password reset. */
export const PASSWORD_RULES: PasswordRule[] = [
    { key: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
    { key: 'lowercase', label: 'A lowercase letter', test: (pw) => /[a-z]/.test(pw) },
    { key: 'uppercase', label: 'An uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
    { key: 'number', label: 'A number', test: (pw) => /[0-9]/.test(pw) },
    { key: 'special', label: 'A special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

/** True when the password satisfies every rule. */
export function isPasswordValid(pw: string): boolean {
    return PASSWORD_RULES.every((rule) => rule.test(pw));
}
