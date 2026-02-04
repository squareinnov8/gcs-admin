import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getAccessTokenFromRefreshToken } from '@/lib/auth';
import { downloadFile, getFileMetadata } from '@/lib/google-drive';
import { uploadFeaturedImage } from '@/lib/featured-image';
import { updatePost } from '@/lib/wordpress';

const IMAGE_FILE_ID = '1vqwSD9kGvPWaFuMeq-EIceoCfnjGepI1';
const YALE_WP_POST_ID = 1164;

/**
 * GET /api/fix-yale-image - Upload specific image to Yale post
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  let accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    accessToken = await getAccessTokenFromRefreshToken();
  }

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // 1. Get file metadata
    const metadata = await getFileMetadata(accessToken, IMAGE_FILE_ID);
    console.log(`[Fix Yale] Downloading: ${metadata.name} (${metadata.mimeType})`);

    // 2. Download from Drive
    const imageBuffer = await downloadFile(accessToken, IMAGE_FILE_ID);
    const base64Data = imageBuffer.toString('base64');

    // 3. Upload to WordPress
    const uploadResult = await uploadFeaturedImage(base64Data, metadata.name, metadata.mimeType);
    if (!uploadResult.success || !uploadResult.mediaId) {
      return NextResponse.json({ error: `Upload failed: ${uploadResult.error}` }, { status: 500 });
    }

    console.log(`[Fix Yale] Uploaded to WordPress: Media ID ${uploadResult.mediaId}`);

    // 4. Attach to Yale post
    const wpResult = await updatePost(YALE_WP_POST_ID, {
      title: 'What Yale Free Tuition Means for Parents Planning Ahead',
      content: '',
      excerpt: '',
      status: 'publish',
      featured_media: uploadResult.mediaId,
    });

    if (!wpResult.success) {
      return NextResponse.json({ error: `Post update failed: ${wpResult.error}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Updated Yale post with "${metadata.name}"`,
      mediaId: uploadResult.mediaId,
      mediaUrl: uploadResult.mediaUrl,
    });
  } catch (error) {
    console.error('[Fix Yale] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
