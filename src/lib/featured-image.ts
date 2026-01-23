import { extractDriveFileId, getFileMetadata, downloadFile } from './google-drive';
import { uploadMedia } from './wordpress';

export interface DownloadedImage {
  success: boolean;
  data?: string; // Base64 encoded
  mimeType?: string;
  filename?: string;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  mediaId?: number;
  mediaUrl?: string;
  error?: string;
}

/**
 * Downloads an image from Google Drive and returns it as base64
 * Used during document processing to show preview
 */
export async function downloadFeaturedImage(
  accessToken: string,
  photoLink: string
): Promise<DownloadedImage> {
  try {
    // Step 1: Extract file ID from the Drive URL
    const fileId = extractDriveFileId(photoLink);
    if (!fileId) {
      return {
        success: false,
        error: `Could not extract file ID from photo link: ${photoLink}`,
      };
    }

    // Step 2: Get file metadata from Drive
    const metadata = await getFileMetadata(accessToken, fileId);

    // Validate it's an image
    if (!metadata.mimeType.startsWith('image/')) {
      return {
        success: false,
        error: `File is not an image: ${metadata.mimeType}`,
      };
    }

    // Step 3: Download the file from Drive
    const imageBuffer = await downloadFile(accessToken, fileId);

    // Step 4: Convert to base64 for preview
    const base64Data = imageBuffer.toString('base64');

    return {
      success: true,
      data: base64Data,
      mimeType: metadata.mimeType,
      filename: metadata.name,
    };
  } catch (error) {
    console.error('Featured image download error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download featured image',
    };
  }
}

/**
 * Uploads an already-downloaded image to WordPress
 * Used during publishing
 */
export async function uploadFeaturedImage(
  imageData: string, // Base64 encoded
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // Convert base64 back to buffer
    const imageBuffer = Buffer.from(imageData, 'base64');

    // Upload to WordPress
    const uploadResult = await uploadMedia(imageBuffer, filename, mimeType);

    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error,
      };
    }

    return {
      success: true,
      mediaId: uploadResult.mediaId,
      mediaUrl: uploadResult.mediaUrl,
    };
  } catch (error) {
    console.error('Featured image upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload featured image',
    };
  }
}
