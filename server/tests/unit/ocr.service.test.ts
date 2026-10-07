import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ocrService,
  validateStorageUrl,
  MAX_OCR_DOWNLOAD_BYTES,
} from '../../src/services/ocr.service.js';
import { ValidationError, AppError } from '../../src/utils/errors.js';

describe('OCR Service Unit & Security Tests', () => {
  const testImagePath = path.resolve(process.cwd(), '../leadflow_ocr_test_salary_slip.png');

  describe('1. SSRF & Storage URL Validation', () => {
    it('accepts valid ImageKit URLs', () => {
      const url = 'https://ik.imagekit.io/leadflow_test/leadflow/brokerage_123/clients/456/doc.png?ik-t=123&ik-s=abc';
      const parsed = validateStorageUrl(url);
      expect(parsed.hostname).toBe('ik.imagekit.io');
    });

    it('rejects disallowed protocols like file: and javascript:', () => {
      expect(() => validateStorageUrl('file:///etc/passwd')).toThrow(ValidationError);
      expect(() => validateStorageUrl('javascript:alert(1)')).toThrow(ValidationError);
      expect(() => validateStorageUrl('ftp://example.com/file.png')).toThrow(ValidationError);
    });

    it('rejects untrusted external domains (SSRF protection)', () => {
      expect(() => validateStorageUrl('https://evil-attacker.com/malicious.png')).toThrow(ValidationError);
      expect(() => validateStorageUrl('https://attacker.net/test.jpg')).toThrow(ValidationError);
    });

    it('rejects invalid or malformed URL strings', () => {
      expect(() => validateStorageUrl('')).toThrow(ValidationError);
      expect(() => validateStorageUrl('not-a-valid-url')).toThrow(ValidationError);
    });
  });

  describe('2. PDF & Format Validation', () => {
    it('marks PDF documents as UNSUPPORTED_FORMAT for safe manual review', async () => {
      const dummyPdfBuffer = Buffer.from('%PDF-1.4 dummy mortgage document header content');
      const result = await ocrService.performOcr(dummyPdfBuffer, 'application/pdf');

      expect(result.status).toBe('UNSUPPORTED_FORMAT');
      expect(result.text).toBe('');
      expect(result.summary).toContain('PDF document received');
      expect(result.summary).toContain('human verification');
    });

    it('handles unsupported audio/binary types gracefully', async () => {
      const randomBuffer = Buffer.from('some random text without headers');
      const result = await ocrService.performOcr(randomBuffer, 'text/plain');

      expect(result.status).toBe('UNSUPPORTED_FORMAT');
      expect(result.summary).toContain('Unsupported document format');
    });
  });

  describe('3. Real Tesseract OCR Execution on Synthetic Document', () => {
    it('successfully extracts expected entities from synthetic salary slip', async () => {
      const imageBuffer = await fs.readFile(testImagePath);
      expect(imageBuffer.length).toBeGreaterThan(0);

      const result = await ocrService.performOcr(imageBuffer, 'image/png');

      expect(result.status).toBe('SUCCESS');
      expect(result.charCount).toBeGreaterThan(50);
      expect(result.wordCount).toBeGreaterThan(10);
      expect(result.durationMs).toBeGreaterThan(0);

      // Verify all 7 required expected values from the task
      expect(result.text).toContain('Rahul Sharma');
      expect(result.text).toContain('LF-1024');
      expect(result.text).toContain('ABC Technologies Pvt. Ltd.');
      expect(result.text).toContain('September 2026');
      expect(result.text).toContain('INR 85,000');
      expect(result.text).toContain('INR 71,200');
      expect(result.text).toContain('ABCDE1234F');

      // Verify summary masks PII and reports counts
      expect(result.summary).toContain('Automated OCR pre-checks passed');
      expect(result.summary).toContain('characters');
      expect(result.summary).not.toContain('Rahul Sharma');
      expect(result.summary).not.toContain('ABCDE1234F');
    });
  });

  describe('4. Error Handling & Timeout Protection', () => {
    it('enforces OCR execution timeout when exceeded', async () => {
      const imageBuffer = await fs.readFile(testImagePath);

      // Extremely small timeout (1ms) guaranteed to trigger timeout protection
      await expect(
        ocrService.performOcr(imageBuffer, 'image/png', { timeoutMs: 1 })
      ).rejects.toThrow(/timed out/i);
    });

    it('enforces max download size constraints', () => {
      expect(MAX_OCR_DOWNLOAD_BYTES).toBe(10 * 1024 * 1024);
    });
  });
});
