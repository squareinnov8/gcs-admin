import { extractDriveFileId, extractDriveFolderId, findImageInFolder, getFileMetadata, downloadFile } from './google-drive';
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
    let fileId = extractDriveFileId(photoLink);
    let metadata;

    // Check if the link is a folder — if so, find the first image inside it
    if (!fileId) {
      const folderId = extractDriveFolderId(photoLink);
      if (folderId) {
        console.log(`Photo link is a folder, searching for image in folder: ${folderId}`);
        const imageFile = await findImageInFolder(accessToken, folderId);
        if (!imageFile) {
          return {
            success: false,
            error: `No image found in Drive folder: ${photoLink}`,
          };
        }
        fileId = imageFile.id;
        metadata = imageFile;
        console.log(`Found image in folder: ${imageFile.name} (${imageFile.mimeType})`);
      } else {
        return {
          success: false,
          error: `Could not extract file or folder ID from photo link: ${photoLink}`,
        };
      }
    }

    // Get file metadata if we don't already have it (direct file link case)
    if (!metadata) {
      metadata = await getFileMetadata(accessToken, fileId!);

      // Validate it's an image
      if (!metadata.mimeType.startsWith('image/')) {
        return {
          success: false,
          error: `File is not an image: ${metadata.mimeType}`,
        };
      }
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
