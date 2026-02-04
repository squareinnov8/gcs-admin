import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getAccessTokenFromRefreshToken } from '@/lib/auth';
import { getDriveClient } from '@/lib/google-drive';
import { downloadFile } from '@/lib/google-drive';
import { uploadFeaturedImage } from '@/lib/featured-image';
import { updatePost } from '@/lib/wordpress';

const YALE_FOLDER_ID = '1n7eude0AxAqj2n_2b9hu_ROJPdPVbo_g';
const YALE_WP_POST_ID = 1164;

/**
 * GET /api/fix-yale-image - Find "post 5.jpg" in the Yale folder,
 * upload to WordPress, and attach to the Yale post.
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
    // 1. Find "post 5.jpg" in the folder
    const drive = await getDriveClient(accessToken);
    const response = await drive.files.list({
      q: `'${YALE_FOLDER_ID}' in parents and name contains 'post 5' and trashed = false`,
      fields: 'files(id, name, mimeType)',
    });

    const files = response.data.files || [];
    if (files.length === 0) {
      return NextResponse.json({ error: 'post 5.jpg not found in folder' }, { status: 404 });
    }

    const imageFile = files[0];
    console.log(`[Fix Yale] Found: ${imageFile.name} (${imageFile.mimeType})`);

    // 2. Download from Drive
    const imageBuffer = await downloadFile(accessToken, imageFile.id!);
    const base64Data = imageBuffer.toString('base64');

    // 3. Upload to WordPress
    const uploadResult = await uploadFeaturedImage(base64Data, imageFile.name!, imageFile.mimeType!);
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
      message: `Updated Yale post with "${imageFile.name}"`,
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
