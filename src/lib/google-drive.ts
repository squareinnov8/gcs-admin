import { google } from 'googleapis';
import { Document } from '@/types';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

export function getGoogleAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );
}

export async function getDriveClient(accessToken: string) {
  const auth = getGoogleAuth();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

export async function listDocuments(accessToken: string): Promise<Document[]> {
  const drive = await getDriveClient(accessToken);
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID is not configured');
  }

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink)',
    orderBy: 'modifiedTime desc',
  });

  const files = response.data.files || [];

  return files.map((file) => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    createdTime: file.createdTime!,
    modifiedTime: file.modifiedTime!,
    webViewLink: file.webViewLink || undefined,
    status: 'pending' as const,
  }));
}

export async function getDocumentContent(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<string> {
  const drive = await getDriveClient(accessToken);

  // Handle Google Docs - export as plain text
  if (mimeType === 'application/vnd.google-apps.document') {
    const response = await drive.files.export({
      fileId,
      mimeType: 'text/html',
    });
    return response.data as string;
  }

  // For other files, download the content
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer).toString('base64');
}

export async function downloadFile(
  accessToken: string,
  fileId: string
): Promise<Buffer> {
  const drive = await getDriveClient(accessToken);

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Extracts the file ID from various Google Drive URL formats
 * Supports: /file/d/ID, /open?id=ID, id=ID query param
 */
export function extractDriveFileId(driveUrl: string): string | null {
  if (!driveUrl) return null;

  // Handle /file/d/FILE_ID format
  const fileMatch = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // Handle /open?id=FILE_ID format
  const openMatch = driveUrl.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  // Handle ?id=FILE_ID or &id=FILE_ID
  const queryMatch = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];

  // Handle raw file ID (no URL)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(driveUrl.trim())) {
    return driveUrl.trim();
  }

  return null;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
}

/**
 * Gets metadata for a specific file by ID
 */
export async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFileMetadata> {
  const drive = await getDriveClient(accessToken);

  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType',
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
    mimeType: response.data.mimeType!,
  };
}
