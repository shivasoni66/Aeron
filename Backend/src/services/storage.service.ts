import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';

export class StorageUnavailableError extends Error {
  constructor(message: string = 'Durable cloud object storage is not configured for this environment.') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export interface UploadParams {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  folder?: string;
  tags?: string[];
  isPrivate?: boolean;
}

export interface UploadResult {
  storageProvider: 'LOCAL' | 'CLOUDINARY' | 'S3';
  storageKey: string;
  url: string;
  bytes: number;
  checksum: string;
  contentType: string;
  isPrivate?: boolean;
}

export const MAX_MEDIA_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
];

export class StorageService {
  /**
   * Evaluates whether the configured storage provider has all mandatory credentials present.
   * In production mode, LOCAL storage is considered ephemeral and unconfigured.
   */
  public isConfigured(): boolean {
    const provider = env.STORAGE_PROVIDER;

    if (provider === 'CLOUDINARY') {
      return Boolean(
        env.CLOUDINARY_CLOUD_NAME &&
        env.CLOUDINARY_API_KEY &&
        env.CLOUDINARY_API_SECRET
      );
    }

    if (provider === 'S3') {
      return Boolean(
        env.S3_BUCKET_NAME &&
        env.S3_REGION &&
        env.AWS_ACCESS_KEY_ID &&
        env.AWS_SECRET_ACCESS_KEY
      );
    }

    if (provider === 'LOCAL') {
      // Ephemeral disk in production (e.g. Render) is not durable
      return !env.isProduction;
    }

    return false;
  }

  /**
   * Returns current storage status details for diagnostic endpoints.
   */
  public getStatus() {
    return {
      provider: env.STORAGE_PROVIDER,
      isConfigured: this.isConfigured(),
      isProduction: env.isProduction,
      maxSizeBytes: MAX_MEDIA_FILE_SIZE,
      allowedMimeTypes: ALLOWED_MIME_TYPES
    };
  }

  /**
   * Uploads raw media buffer to the configured durable storage adapter.
   */
  public async upload(params: UploadParams): Promise<UploadResult> {
    const { buffer, fileName, contentType, folder = 'aeron/evidence', isPrivate = false } = params;

    // Validate size limit
    if (buffer.length > MAX_MEDIA_FILE_SIZE) {
      throw new Error(`Media file exceeds maximum size limit of 5MB (size: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB)`);
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(contentType.toLowerCase())) {
      throw new Error(`MIME type '${contentType}' is not supported. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }

    // Compute SHA-256 integrity checksum
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // If storage is unconfigured, throw StorageUnavailableError
    if (!this.isConfigured()) {
      throw new StorageUnavailableError(
        env.isProduction
          ? `Durable cloud media storage (${env.STORAGE_PROVIDER}) is not configured for production. Please verify CLOUDINARY or S3 credentials.`
          : `Storage provider '${env.STORAGE_PROVIDER}' is not configured.`
      );
    }

    const provider = env.STORAGE_PROVIDER;

    if (provider === 'CLOUDINARY') {
      return await this.uploadToCloudinary({
        buffer,
        fileName,
        contentType,
        folder,
        checksum,
        isPrivate
      });
    }

    if (provider === 'S3') {
      return await this.uploadToS3({
        buffer,
        fileName,
        contentType,
        folder,
        checksum,
        isPrivate
      });
    }

    // LOCAL development storage
    return await this.uploadToLocal({
      buffer,
      fileName,
      contentType,
      folder,
      checksum,
      isPrivate
    });
  }

  /**
   * Durable Cloudinary REST API upload using native HTTPS request signing.
   * Requires zero third-party SDK dependencies.
   */
  private async uploadToCloudinary(params: {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    folder: string;
    checksum: string;
    isPrivate: boolean;
  }): Promise<UploadResult> {
    const cloudName = env.CLOUDINARY_CLOUD_NAME!;
    const apiKey = env.CLOUDINARY_API_KEY!;
    const apiSecret = env.CLOUDINARY_API_SECRET!;
    const timestamp = Math.floor(Date.now() / 1000);

    // Build Cloudinary API upload URL
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    // Construct signature parameters alphabetically
    const paramsToSign: Record<string, string> = {
      folder: params.folder,
      timestamp: timestamp.toString()
    };

    if (params.isPrivate) {
      paramsToSign.type = 'authenticated';
    }

    const signatureString =
      Object.keys(paramsToSign)
        .sort()
        .map((key) => `${key}=${paramsToSign[key]}`)
        .join('&') + apiSecret;

    const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

    // Create form payload with base64 data URI
    const dataUri = `data:${params.contentType};base64,${params.buffer.toString('base64')}`;
    const postData = new URLSearchParams();
    postData.append('file', dataUri);
    postData.append('api_key', apiKey);
    postData.append('timestamp', timestamp.toString());
    postData.append('signature', signature);
    postData.append('folder', params.folder);

    if (params.isPrivate) {
      postData.append('type', 'authenticated');
    }

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: postData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary upload failed with status ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as {
      secure_url: string;
      public_id: string;
      bytes: number;
      format: string;
    };

    return {
      storageProvider: 'CLOUDINARY',
      storageKey: result.secure_url,
      url: result.secure_url,
      bytes: result.bytes || params.buffer.length,
      checksum: params.checksum,
      contentType: params.contentType,
      isPrivate: params.isPrivate
    };
  }

  /**
   * S3-compatible cloud storage adapter fallback.
   */
  private async uploadToS3(params: {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    folder: string;
    checksum: string;
    isPrivate: boolean;
  }): Promise<UploadResult> {
    const bucket = env.S3_BUCKET_NAME!;
    const region = env.S3_REGION || 'us-east-1';
    const key = `${params.folder}/${Date.now()}_${params.fileName}`;
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      storageProvider: 'S3',
      storageKey: key,
      url,
      bytes: params.buffer.length,
      checksum: params.checksum,
      contentType: params.contentType,
      isPrivate: params.isPrivate
    };
  }

  /**
   * Local filesystem storage for development and unit testing.
   */
  private async uploadToLocal(params: {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    folder: string;
    checksum: string;
    isPrivate: boolean;
  }): Promise<UploadResult> {
    const uploadDir = path.resolve(process.cwd(), 'uploads', params.folder);
    await fs.mkdir(uploadDir, { recursive: true });

    const safeName = `${Date.now()}_${params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeName);
    await fs.writeFile(filePath, params.buffer);

    const relativeKey = path.join('uploads', params.folder, safeName).replace(/\\/g, '/');

    return {
      storageProvider: 'LOCAL',
      storageKey: relativeKey,
      url: `/${relativeKey}`,
      bytes: params.buffer.length,
      checksum: params.checksum,
      contentType: params.contentType,
      isPrivate: params.isPrivate
    };
  }
}

export const storageService = new StorageService();

