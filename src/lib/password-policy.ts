/**
 * The password policy, mirroring the API's `PasswordPolicy` / `@ValidPassword`
 * (tenant registration, password reset, admin-created users, change password).
 * BCrypt reads at most 72 bytes, so the maximum is counted in UTF-8 bytes.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

const utf8Length = (value: string): number => new TextEncoder().encode(value).length;

/** An error message, or true when the password is acceptable. Empty is left to `required`. */
export function validatePassword(value: unknown): true | string {
    if (typeof value !== "string" || value === "") return true;
    if (value.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    if (utf8Length(value) > PASSWORD_MAX_BYTES) {
        return `Password must be at most ${PASSWORD_MAX_BYTES} bytes (${PASSWORD_MAX_BYTES} plain characters)`;
    }
    return true;
}

/** react-hook-form rules for a new-password input. */
export function passwordRules(required: string | false = "Password is required") {
    return { required, validate: validatePassword };
}

/** HTML attributes for a new-password input (maxLength counts characters, the byte rule is in validate). */
export const PASSWORD_INPUT_PROPS = { minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_BYTES } as const;
