import { randomUUID } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.config.js';

export const MAX_STUDY_BYTES = 10 * 1024 * 1024;
export const STUDY_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type StudyMimeType = typeof STUDY_MIME_TYPES[number];
const s3 = new S3Client({ region: env.AWS_REGION });

export function isStorageConfigured(): boolean {
  return Boolean(env.AWS_S3_BUCKET_NAME)
    && !/replace|example|tudominio/i.test(`${env.AWS_S3_BUCKET_NAME}${process.env.AWS_ACCESS_KEY_ID || ''}${process.env.AWS_SECRET_ACCESS_KEY || ''}`);
}

function bucket(): string {
  if (!isStorageConfigured() || !env.AWS_S3_BUCKET_NAME) {
    throw new Error('Configura AWS_S3_BUCKET_NAME para habilitar estudios clínicos.');
  }
  return env.AWS_S3_BUCKET_NAME;
}

export function cleanStudyName(value: string): string {
  return value.replace(/[\\/\x00-\x1f\x7f]/g, '').trim().slice(0, 255);
}

export function isSupportedStudy(mimeType: string, bytes: number): mimeType is StudyMimeType {
  return STUDY_MIME_TYPES.includes(mimeType as StudyMimeType) && Number.isInteger(bytes) && bytes > 0 && bytes <= MAX_STUDY_BYTES;
}

export function hasExpectedMagic(bytes: Uint8Array, mimeType: StudyMimeType): boolean {
  if (mimeType === 'application/pdf') return Buffer.from(bytes.subarray(0, 5)).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

export async function createStudyUpload(patientId: string, mimeType: StudyMimeType) {
  const Bucket = bucket();
  const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[mimeType];
  const Key = `patients/${patientId}/${randomUUID()}.${extension}`;
  const encryption = env.AWS_S3_KMS_KEY_ID ? 'aws:kms' : 'AES256';
  const Fields: Record<string, string> = {
    'Content-Type': mimeType,
    'x-amz-server-side-encryption': encryption,
  };
  if (env.AWS_S3_KMS_KEY_ID) Fields['x-amz-server-side-encryption-aws-kms-key-id'] = env.AWS_S3_KMS_KEY_ID;
  const Conditions: Array<Record<string, string> | ['content-length-range', number, number]> = [
    { 'Content-Type': mimeType },
    { 'x-amz-server-side-encryption': encryption },
    // El POST multipart añade campos de firma al tamaño del archivo.
    ['content-length-range', 1, MAX_STUDY_BYTES + 16 * 1024],
  ];
  if (env.AWS_S3_KMS_KEY_ID) Conditions.push({ 'x-amz-server-side-encryption-aws-kms-key-id': env.AWS_S3_KMS_KEY_ID });
  const signed = await createPresignedPost(s3, {
    Bucket, Key, Fields, Conditions,
    Expires: 15 * 60,
  });
  return { bucket: Bucket, key: Key, url: signed.url, fields: signed.fields, expiresAt: new Date(Date.now() + 15 * 60 * 1000) };
}

export async function verifyStudyObject(input: { bucket: string; key: string; mimeType: StudyMimeType; sizeBytes: number }): Promise<void> {
  const head = await s3.send(new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }));
  if (head.ContentLength !== input.sizeBytes || head.ContentLength > MAX_STUDY_BYTES || head.ContentType !== input.mimeType) {
    throw new Error('El tamaño o tipo del archivo no coincide con el registro de carga.');
  }
  const expectedEncryption = env.AWS_S3_KMS_KEY_ID ? 'aws:kms' : 'AES256';
  if (head.ServerSideEncryption !== expectedEncryption) throw new Error('El archivo no tiene el cifrado requerido.');
  const firstBytes = await s3.send(new GetObjectCommand({ Bucket: input.bucket, Key: input.key, Range: 'bytes=0-7' }));
  const bytes = await firstBytes.Body?.transformToByteArray();
  if (!bytes || !hasExpectedMagic(bytes, input.mimeType)) throw new Error('El contenido no corresponde a PDF, JPG o PNG.');
}

export async function studyReadUrl(bucketName: string, key: string): Promise<string> {
  if (bucketName !== bucket()) throw new Error('El archivo pertenece a otro almacenamiento.');
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName, Key: key }), { expiresIn: 15 * 60 });
}
