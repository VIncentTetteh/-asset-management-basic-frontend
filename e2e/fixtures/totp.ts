import { createHmac } from "node:crypto";

/** RFC 6238 defaults used by every mainstream authenticator app. */
const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decodes an RFC 4648 base32 secret (case, spaces and padding ignored). */
export function base32Decode(secret: string): Buffer {
    const clean = secret.replace(/[\s=-]/g, "").toUpperCase();
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const char of clean) {
        const index = BASE32_ALPHABET.indexOf(char);
        if (index < 0) throw new Error("TOTP secret is not valid base32");
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/** HOTP (RFC 4226) for one counter value, HMAC-SHA1. */
export function hotp(key: Buffer, counter: number): string {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac("sha1", key).update(message).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
    return binary.toString().padStart(DIGITS, "0");
}

export const totpCounter = (nowMs: number = Date.now()): number => Math.floor(nowMs / 1000 / STEP_SECONDS);

/** The current TOTP code for a base32 secret. */
export function totp(secret: string, nowMs: number = Date.now()): string {
    return hotp(base32Decode(secret), totpCounter(nowMs));
}

let lastUsedCounter = -1;

/**
 * A code the server has not seen yet. Servers reject a replayed code within the
 * same window, so when this worker already spent the current window's code
 * (login, then a step-up seconds later) wait for the next window.
 */
export async function freshTotp(secret: string): Promise<string> {
    let counter = totpCounter();
    if (counter <= lastUsedCounter) {
        const nextWindowMs = (lastUsedCounter + 1) * STEP_SECONDS * 1000;
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, nextWindowMs - Date.now()) + 250));
        counter = totpCounter();
    }
    lastUsedCounter = counter;
    return hotp(base32Decode(secret), counter);
}
