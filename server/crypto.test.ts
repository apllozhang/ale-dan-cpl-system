import { describe, it, expect, beforeEach, vi } from "vitest";

// Set up encryption key before importing crypto module
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.AI_ENCRYPTION_KEY = TEST_KEY;

const { encrypt, decrypt, maskApiKey } = await import("./_core/crypto.js");

describe("crypto", () => {
  describe("encrypt / decrypt", () => {
    it("should encrypt and decrypt a string round-trip", () => {
      const original = "sk-test-api-key-12345678";
      const encrypted = encrypt(original);
      expect(encrypted).not.toBe(original);
      expect(decrypt(encrypted)).toBe(original);
    });

    it("should produce different ciphertext each time (random IV)", () => {
      const original = "same-input";
      const encrypted1 = encrypt(original);
      const encrypted2 = encrypt(original);
      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(original);
      expect(decrypt(encrypted2)).toBe(original);
    });

    it("should throw on empty string", () => {
      expect(() => encrypt("")).toThrow("empty string");
    });

    it("should handle unicode characters", () => {
      const original = "密钥-🔑-テスト";
      const encrypted = encrypt(original);
      expect(decrypt(encrypted)).toBe(original);
    });

    it("should throw on invalid ciphertext", () => {
      expect(() => decrypt("invalid-base64!!")).toThrow();
    });

    it("should throw on tampered ciphertext", () => {
      const encrypted = encrypt("secret");
      // Tamper with the base64 by flipping last char
      const tampered = encrypted.slice(0, -1) + (encrypted.slice(-1) === "A" ? "B" : "A");
      expect(() => decrypt(tampered)).toThrow();
    });

    it("should throw if AI_ENCRYPTION_KEY is not set", () => {
      const original = process.env.AI_ENCRYPTION_KEY;
      delete process.env.AI_ENCRYPTION_KEY;
      expect(() => encrypt("test")).toThrow("AI_ENCRYPTION_KEY");
      process.env.AI_ENCRYPTION_KEY = original;
    });

    it("should throw if AI_ENCRYPTION_KEY is wrong length", () => {
      const original = process.env.AI_ENCRYPTION_KEY;
      process.env.AI_ENCRYPTION_KEY = "tooshort";
      expect(() => encrypt("test")).toThrow("32 bytes");
      process.env.AI_ENCRYPTION_KEY = original;
    });
  });

  describe("maskApiKey", () => {
    it("should mask middle of API key", () => {
      expect(maskApiKey("sk-1234567890abcdef")).toBe("sk-1...cdef");
    });

    it("should handle short keys", () => {
      expect(maskApiKey("short")).toBe("****");
    });

    it("should handle exactly 8 chars", () => {
      expect(maskApiKey("12345678")).toBe("1234...5678");
    });
  });
});
