import ImageKit, { toFile } from '@imagekit/nodejs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import type { IDomainService } from './base.service.js';

export interface StorageUploadOptions {
  file: Buffer;
  fileName: string;
  mimeType?: string | undefined;
  folder?: string | undefined;
  tags?: string[] | undefined;
}

export interface StorageUploadResult {
  fileId: string;
  fileUrl: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  thumbnailUrl?: string | undefined;
}

export interface IStorageService extends IDomainService {
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;
  deleteFile(fileId: string): Promise<void>;
}

export class ImageKitStorageService implements IStorageService {
  readonly serviceName = 'ImageKitStorageService';
  private client: ImageKit | null = null;
  private isMockMode: boolean;

  constructor() {
    this.isMockMode =
      env.isTest ||
      env.IMAGEKIT_PRIVATE_KEY === 'private_mock_imagekit_key' ||
      env.IMAGEKIT_PRIVATE_KEY.startsWith('mock_');

    if (!this.isMockMode) {
      this.client = new ImageKit({
        privateKey: env.IMAGEKIT_PRIVATE_KEY,
      });
    }
  }

  /**
   * Sanitizes original file name by stripping dangerous path traversal characters
   * and prefixing with timestamp and random bytes to avoid collisions.
   */
  sanitizeFileName(originalName: string): string {
    const baseName = originalName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '')
      .substring(0, 100);
    const prefix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return `${prefix}_${baseName || 'document.pdf'}`;
  }

  /**
   * Uploads file buffer to ImageKit under a server-controlled folder hierarchy.
   */
  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const cleanFileName = this.sanitizeFileName(options.fileName);
    const folder = options.folder || '/leadflow/documents';

    if (this.isMockMode || !this.client) {
      logger.debug(
        { folder, fileName: cleanFileName, fileSize: options.file.length },
        'ImageKit simulated storage upload (mock mode)'
      );
      const mockFileId = `ik_file_${crypto.randomBytes(8).toString('hex')}`;
      const normalizedPath = `${folder}/${cleanFileName}`.replace(/\/+/g, '/');
      const mockUrl = `${env.IMAGEKIT_URL_ENDPOINT.replace(/\/$/, '')}${normalizedPath}`;

      return {
        fileId: mockFileId,
        fileUrl: mockUrl,
        filePath: normalizedPath,
        fileName: cleanFileName,
        fileSize: options.file.length,
        thumbnailUrl: `${mockUrl}?tr=w-200,h-200`,
      };
    }

    try {
      const uploadable = await toFile(options.file, cleanFileName, {
        type: options.mimeType || 'application/octet-stream',
      });

      const response = await this.client.files.upload({
        file: uploadable,
        fileName: cleanFileName,
        folder,
        tags: options.tags || ['leadflow', 'document'],
        useUniqueFileName: true,
      });

      return {
        fileId: response.fileId || `ik_file_${crypto.randomBytes(8).toString('hex')}`,
        fileUrl: response.url || '',
        filePath: response.filePath || `${folder}/${cleanFileName}`,
        fileName: response.name || cleanFileName,
        fileSize: response.size || options.file.length,
        thumbnailUrl: response.thumbnailUrl || undefined,
      };
    } catch (error: any) {
      logger.error(
        {
          errorMessage: error?.message,
          errorStatus: error?.status,
          folder,
        },
        'ImageKit storage upload failed'
      );
      throw new AppError('File storage service upload failed', 502, 'STORAGE_UPLOAD_ERROR');
    }
  }

  /**
   * Deletes an uploaded file from ImageKit for defensive rollback or removal.
   */
  async deleteFile(fileId: string): Promise<void> {
    if (!fileId) return;

    if (this.isMockMode || !this.client) {
      logger.debug({ fileId }, 'ImageKit simulated storage deletion (mock mode)');
      return;
    }

    try {
      await this.client.files.delete(fileId);
      logger.info({ fileId }, 'Successfully deleted file from ImageKit');
    } catch (error: any) {
      // Do not rethrow in compensation paths, but log prominently for audit
      logger.warn(
        { fileId, errorMessage: error?.message },
        'Failed to delete file from ImageKit during cleanup'
      );
    }
  }
}

export const storageService = new ImageKitStorageService();
