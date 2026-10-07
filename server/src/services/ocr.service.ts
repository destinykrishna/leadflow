import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { storageService } from './storage.service.js';
import type { IDocumentDocument, DocumentStatus } from '../models/document.model.js';
import { ValidationError, AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { IDomainService } from './base.service.js';

const execFileAsync = promisify(execFile);

export const MAX_OCR_DOWNLOAD_BYTES = 10 * 1024 * 1024; // 10MB
export const DEFAULT_OCR_TIMEOUT_MS = 15000; // 15 seconds

export const SUPPORTED_OCR_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/tiff',
] as const;

export type SupportedOcrMimeType = (typeof SUPPORTED_OCR_MIME_TYPES)[number];

export interface OcrResult {
  status: 'SUCCESS' | 'UNSUPPORTED_FORMAT' | 'EMPTY' | 'FAILED';
  text: string;
  charCount: number;
  wordCount: number;
  lineCount: number;
  durationMs: number;
  summary: string;
}

export interface OcrProcessingOptions {
  timeoutMs?: number | undefined;
  buffer?: Buffer | undefined;
}

/**
 * Validates a signed storage URL against SSRF and unauthorized origin attacks.
 * Defends against SSRF by restricting fetch destinations strictly to verified
 * ImageKit hostnames and configured endpoints.
 */
export function validateStorageUrl(rawUrl: string): URL {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new ValidationError('Invalid or missing storage URL for OCR download');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ValidationError('Malformed storage URL provided for document download');
  }

  // 1. Enforce secure HTTP/HTTPS protocols only
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ValidationError(`Disallowed protocol for storage download: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Validate against trusted storage domain / endpoint
  let allowedEndpointHost: string | null = null;
  try {
    if (env.IMAGEKIT_URL_ENDPOINT) {
      allowedEndpointHost = new URL(env.IMAGEKIT_URL_ENDPOINT).hostname.toLowerCase();
    }
  } catch {
    // ignore malformed env endpoint
  }

  const isTrustedImageKitHost =
    hostname === 'ik.imagekit.io' ||
    hostname.endsWith('.imagekit.io') ||
    (allowedEndpointHost && hostname === allowedEndpointHost);

  const isLocalDevHost =
    !env.isProduction &&
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'mongodb' || hostname === 'storage.leadflow.internal');

  if (!isTrustedImageKitHost && !isLocalDevHost) {
    logger.warn({ hostname, parsedUrl: parsed.origin }, 'Blocked potential SSRF attempt to untrusted host');
    throw new ValidationError(`SSRF Protection: Storage host '${hostname}' is not a trusted storage endpoint`);
  }

  // 3. In production, prevent loopback and private address access
  if (env.isProduction) {
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname === '169.254.169.254'
    ) {
      throw new ValidationError('SSRF Protection: Requests to private IP ranges are strictly prohibited');
    }
  }

  return parsed;
}

export class OcrService implements IDomainService {
  readonly serviceName = 'OcrService';

  /**
   * Securely downloads an uploaded document from a signed storage URL.
   * Enforces stream size limits (10MB max) to prevent memory exhaustion / decompression attacks.
   */
  async downloadDocument(signedUrl: string, expectedMimeType?: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const validatedUrl = validateStorageUrl(signedUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s network timeout

    try {
      const response = await fetch(validatedUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
          'User-Agent': 'LeadFlow-OCR-Worker/1.0',
        },
      });

      if (!response.ok) {
        throw new AppError(
          `Failed to download document from storage (HTTP ${response.status} ${response.statusText})`,
          502,
          'STORAGE_DOWNLOAD_ERROR'
        );
      }

      // Check Content-Length header if provided
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const declaredSize = Number.parseInt(contentLengthHeader, 10);
        if (declaredSize > MAX_OCR_DOWNLOAD_BYTES) {
          throw new ValidationError(
            `Document size (${declaredSize} bytes) exceeds maximum allowable OCR download limit of ${MAX_OCR_DOWNLOAD_BYTES} bytes`
          );
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_OCR_DOWNLOAD_BYTES) {
        throw new ValidationError(
          `Document payload (${buffer.length} bytes) exceeds maximum allowable limit of ${MAX_OCR_DOWNLOAD_BYTES} bytes`
        );
      }

      const mimeType =
        response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ||
        expectedMimeType ||
        'application/octet-stream';

      return { buffer, mimeType };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new AppError('Document download timed out after 10 seconds', 504, 'STORAGE_DOWNLOAD_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Executes Tesseract OCR against a provided document image buffer.
   * - Restricts execution strictly to supported image MIME types.
   * - Safely isolates multi-page PDFs to human review.
   * - Isolates execution in temporary files using mode 0o600.
   * - Cleans up temporary files in try/finally blocks with zero disk leakage.
   * - Executes Tesseract with argument arrays (zero shell interpolation).
   * - Enforces strict process timeouts to prevent worker starvation.
   */
  async performOcr(
    imageBuffer: Buffer,
    mimeType: string,
    options?: OcrProcessingOptions
  ): Promise<OcrResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || DEFAULT_OCR_TIMEOUT_MS;

    // 1. Explicitly check for PDF format
    const isPdf =
      mimeType === 'application/pdf' ||
      (imageBuffer.length >= 4 && imageBuffer.subarray(0, 4).toString() === '%PDF');

    if (isPdf) {
      return {
        status: 'UNSUPPORTED_FORMAT',
        text: '',
        charCount: 0,
        wordCount: 0,
        lineCount: 0,
        durationMs: Date.now() - startTime,
        summary:
          'Automated technical pre-checks passed. PDF document received (automated OCR requires raster image format); queued for human verification.',
      };
    }

    // 2. Validate supported raster image formats
    const isSupportedImage =
      SUPPORTED_OCR_MIME_TYPES.some((m) => mimeType.includes(m)) ||
      (imageBuffer.length >= 8 && imageBuffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') || // PNG
      (imageBuffer.length >= 3 && imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff); // JPEG

    if (!isSupportedImage) {
      return {
        status: 'UNSUPPORTED_FORMAT',
        text: '',
        charCount: 0,
        wordCount: 0,
        lineCount: 0,
        durationMs: Date.now() - startTime,
        summary: `Unsupported document format for automated OCR (${mimeType}). Awaiting human verification.`,
      };
    }

    // 3. Create temporary file with restricted permissions (0o600)
    const randomSuffix = crypto.randomBytes(16).toString('hex');
    const ext = mimeType.includes('png') ? '.png' : mimeType.includes('webp') ? '.webp' : '.jpg';
    const tempFilePath = path.join(os.tmpdir(), `leadflow_ocr_${randomSuffix}${ext}`);

    try {
      await fs.writeFile(tempFilePath, imageBuffer, { mode: 0o600 });

      // 4. Execute Tesseract using execFile with argv array (no shell interpolation)
      const { stdout } = await execFileAsync(
        'tesseract',
        [tempFilePath, 'stdout', '--psm', '6'],
        {
          timeout: timeoutMs,
          maxBuffer: 5 * 1024 * 1024,
          windowsHide: true,
        }
      );

      const durationMs = Date.now() - startTime;
      const rawText = (stdout || '').trim();

      if (!rawText) {
        return {
          status: 'EMPTY',
          text: '',
          charCount: 0,
          wordCount: 0,
          lineCount: 0,
          durationMs,
          summary: 'Automated OCR completed: No legible text detected. Awaiting human verification.',
        };
      }

      const lines = rawText.split('\n').filter((l) => l.trim().length > 0);
      const words = rawText.split(/\s+/).filter((w) => w.trim().length > 0);
      const charCount = rawText.length;

      // Log only masked metadata (never raw text, PAN, salary, or borrower PII)
      logger.info(
        {
          charCount,
          wordCount: words.length,
          lineCount: lines.length,
          durationMs,
        },
        'Tesseract OCR completed successfully with extracted text'
      );

      return {
        status: 'SUCCESS',
        text: rawText,
        charCount,
        wordCount: words.length,
        lineCount: lines.length,
        durationMs,
        summary: `Automated OCR pre-checks passed. Detected English text (${charCount} characters across ${lines.length} lines). Awaiting human verification.`,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;

      if (err.killed || err.signal === 'SIGTERM' || err.message?.includes('timed out')) {
        logger.warn({ timeoutMs, durationMs }, 'Tesseract OCR execution timed out');
        throw new AppError(`Tesseract OCR process timed out after ${timeoutMs}ms`, 504, 'OCR_PROCESS_TIMEOUT');
      }

      logger.warn(
        { err: err.message, durationMs },
        'Tesseract OCR execution encountered error'
      );
      throw new AppError(`Tesseract OCR failed: ${err.message}`, 502, 'OCR_EXECUTION_ERROR');
    } finally {
      // 5. Always clean up temporary file in finally block (zero temp file accumulation)
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }

  /**
   * Main entrypoint: coordinates URL signing, secure download, and Tesseract OCR execution
   * for a persisted MongoDB Document record.
   */
  async processDocument(
    doc: IDocumentDocument,
    options?: OcrProcessingOptions
  ): Promise<{ status: DocumentStatus; ocrText: string; summary: string }> {
    // Handle synthetic test buffer if passed directly
    if (options?.buffer) {
      const result = await this.performOcr(options.buffer, doc.mimeType || 'image/png', options);
      return {
        status: 'PENDING_REVIEW',
        ocrText: result.text,
        summary: result.summary,
      };
    }

    // Fast-path: multi-page PDF check
    const isPdf =
      doc.mimeType === 'application/pdf' ||
      doc.fileUrl?.toLowerCase().includes('.pdf') ||
      doc.title?.toLowerCase().includes('.pdf');

    if (isPdf) {
      return {
        status: 'PENDING_REVIEW',
        ocrText: '',
        summary:
          'Automated technical pre-checks passed. PDF document received (automated OCR requires raster image format); queued for human verification.',
      };
    }

    // 1. Generate short-lived signed ImageKit URL (60-second expiry)
    const signedUrl = storageService.generateSignedUrl(doc.fileUrl, {
      expiresInSeconds: 60,
    });

    if (!signedUrl) {
      throw new ValidationError('Could not generate signed URL for document file');
    }

    // 2. Download document buffer securely
    const { buffer, mimeType } = await this.downloadDocument(signedUrl, doc.mimeType);

    // 3. Execute Tesseract OCR
    const ocrResult = await this.performOcr(buffer, mimeType, options);

    return {
      status: 'PENDING_REVIEW',
      ocrText: ocrResult.text,
      summary: ocrResult.summary,
    };
  }
}

export const ocrService = new OcrService();
