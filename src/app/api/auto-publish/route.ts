import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getAccessTokenFromRefreshToken } from '@/lib/auth';
import { getContentRepoData, updateRowAfterPublish, sheetRowToMetadata, SheetRow } from '@/lib/google-sheets';
import { getDocumentContent, extractDriveFileId } from '@/lib/google-drive';
import { processDocument, extractTitleFromContent } from '@/lib/document-processor';
import { downloadFeaturedImage } from '@/lib/featured-image';
import { uploadFeaturedImage } from '@/lib/featured-image';
import { createPost, updatePost, getOrCreateCategory, getOrCreateTags } from '@/lib/wordpress';
import { DocumentMetadata, WordPressPost } from '@/types';

// Status values that trigger auto-publish
const READY_STATUSES = ['ready to post', 'ready', 'readytopost', 'publish'];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Parses a date string from the sheet (various formats) into ISO format for WordPress.
 * Returns undefined if the date can't be parsed.
 */
function parsePostDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;

  const trimmed = dateStr.trim();

  // Try parsing with Date constructor (handles M/D/YYYY, YYYY-MM-DD, etc.)
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    // Format as YYYY-MM-DDTHH:MM:SS for WordPress
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T12:00:00`;
  }

  return undefined;
}

interface PublishResult {
  row: number;
  title: string;
  success: boolean;
  postId?: number;
  postUrl?: string;
  error?: string;
}

async function publishRow(
  accessToken: string,
  row: SheetRow
): Promise<PublishResult> {
  const result: PublishResult = {
    row: row.rowIndex,
    title: row.title || row.blogPost,
    success: false,
  };

  try {
    // 1. Get document content from Drive
    const driveFileId = extractDriveFileId(row.blogLink);
    if (!driveFileId) {
      result.error = 'No valid Drive link in Column K (Blog Link)';
      return result;
    }

    let content = '';
    try {
      const rawHtml = await getDocumentContent(accessToken, driveFileId, 'application/vnd.google-apps.document');
      content = await processDocument(rawHtml, 'application/vnd.google-apps.document', row.blogPost || row.title);

      // Extract and remove title from content
      const { title: extractedTitle, contentWithoutTitle } = extractTitleFromContent(content);
      content = contentWithoutTitle;
    } catch (driveError) {
      result.error = `Failed to fetch document: ${driveError}`;
      return result;
    }

    if (!content) {
      result.error = 'Document has no content';
      return result;
    }

    // 2. Build metadata from sheet
    const sheetMetadata = sheetRowToMetadata(row);
    const postDate = parsePostDate(row.postDate);
    const metadata: DocumentMetadata = {
      title: sheetMetadata.title || row.title || row.blogPost,
      slug: sheetMetadata.slug || generateSlug(sheetMetadata.title || row.title || row.blogPost),
      description: sheetMetadata.seoDescription || '',
      excerpt: sheetMetadata.seoDescription || '',
      category: sheetMetadata.category || 'General',
      tags: sheetMetadata.tags || [],
      author: 'CommonCents Team',
      publishDate: postDate || new Date().toISOString().split('T')[0],
      seoTitle: sheetMetadata.seoTitle || sheetMetadata.title,
      seoDescription: sheetMetadata.seoDescription || '',
      photoLink: sheetMetadata.photoLink,
      format: 'standard',
      metadataSource: 'sheet',
    };

    if (postDate) {
      console.log(`[Auto-publish Row ${row.rowIndex}] Using post date from sheet: ${postDate}`);
    }

    // 3. Download and upload featured image
    let featuredMediaId: number | undefined;
    if (row.photoLink) {
      try {
        console.log(`[Auto-publish Row ${row.rowIndex}] Downloading featured image...`);
        const imageResult = await downloadFeaturedImage(accessToken, row.photoLink);

        if (imageResult.success && imageResult.data && imageResult.filename && imageResult.mimeType) {
          const uploadResult = await uploadFeaturedImage(
            imageResult.data,
            imageResult.filename,
            imageResult.mimeType
          );

          if (uploadResult.success && uploadResult.mediaId) {
            featuredMediaId = uploadResult.mediaId;
            console.log(`[Auto-publish Row ${row.rowIndex}] Featured image uploaded: ID ${featuredMediaId}`);
          }
        }
      } catch (imageError) {
        console.warn(`[Auto-publish Row ${row.rowIndex}] Image upload failed:`, imageError);
        // Continue without image
      }
    }

    // 4. Get/create category and tags
    const categoryId = await getOrCreateCategory(metadata.category);
    const tagIds = metadata.tags.length > 0 ? await getOrCreateTags(metadata.tags) : [];

    // 5. Create or update WordPress post
    const post: WordPressPost = {
      title: metadata.title,
      content,
      excerpt: metadata.excerpt,
      slug: metadata.slug,
      status: 'publish',
      date: postDate,
      categories: [categoryId],
      tags: tagIds,
      featured_media: featuredMediaId,
      format: 'standard',
      meta: {
        _yoast_wpseo_title: metadata.seoTitle || metadata.title,
        _yoast_wpseo_metadesc: metadata.seoDescription || metadata.excerpt,
      },
    };

    let wpResult;
    const existingWpId = row.wordpressId ? parseInt(row.wordpressId) : null;

    if (existingWpId) {
      console.log(`[Auto-publish Row ${row.rowIndex}] Updating existing post: WP ID ${existingWpId}`);
      wpResult = await updatePost(existingWpId, post);
    } else {
      wpResult = await createPost(post);
    }

    if (!wpResult.success || !wpResult.postId) {
      result.error = wpResult.error || 'WordPress publish failed';
      return result;
    }

    // 6. Update sheet with success
    await updateRowAfterPublish(accessToken, row.rowIndex, 'Posted', wpResult.postId);

    result.success = true;
    result.postId = wpResult.postId;
    result.postUrl = wpResult.postUrl;

    console.log(`[Auto-publish Row ${row.rowIndex}] Successfully published: ${metadata.title} (WP ID: ${wpResult.postId})`);

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

/**
 * GET /api/auto-publish - Check for and publish "ready to post" items
 * Can be called by:
 * - Cron job (Vercel cron, external service)
 * - Google Apps Script trigger
 * - Manual trigger from admin UI
 */
export async function GET(request: NextRequest) {
  // Check for API key or Vercel cron secret
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.AUTO_PUBLISH_API_KEY;
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '');
  const isVercelCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  // Allow: valid session, valid API key, or Vercel cron
  const session = await getServerSession(authOptions);
  let accessToken = (session as any)?.accessToken;

  if (!accessToken && !isVercelCron && (!apiKey || apiKey !== expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // For cron/API key auth, get token from stored refresh token
  if (!accessToken) {
    accessToken = await getAccessTokenFromRefreshToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Could not obtain Google access token. Set GOOGLE_REFRESH_TOKEN env var.' },
        { status: 500 }
      );
    }
  }

  try {
    console.log('[Auto-publish] Checking for ready items...');

    // Fetch all rows from sheet
    const rows = await getContentRepoData(accessToken);

    // Find rows with "ready to post" status (case-insensitive)
    const readyRows = rows.filter((row) => {
      const status = row.status.toLowerCase().replace(/\s+/g, '');
      return READY_STATUSES.some((s) => status === s.replace(/\s+/g, ''));
    });

    console.log(`[Auto-publish] Found ${readyRows.length} items ready to post`);

    if (readyRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items ready to post',
        processed: 0,
        results: [],
      });
    }

    // Process each ready row
    const results: PublishResult[] = [];
    for (const row of readyRows) {
      console.log(`[Auto-publish] Processing row ${row.rowIndex}: ${row.title || row.blogPost}`);
      const result = await publishRow(accessToken, row);
      results.push(result);

      // Small delay between posts to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} items: ${successful} published, ${failed} failed`,
      processed: results.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error('[Auto-publish] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-publish failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auto-publish - Publish a specific row (for webhook triggers)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  let accessToken = (session as any)?.accessToken;

  // Check API key for external calls
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.AUTO_PUBLISH_API_KEY;

  if (!accessToken && (!apiKey || apiKey !== expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // For API key auth, get token from stored refresh token
  if (!accessToken) {
    accessToken = await getAccessTokenFromRefreshToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Could not obtain Google access token. Set GOOGLE_REFRESH_TOKEN env var.' },
        { status: 500 }
      );
    }
  }

  try {
    const { rowIndex } = await request.json();

    if (!rowIndex) {
      return NextResponse.json({ error: 'rowIndex required' }, { status: 400 });
    }

    // Fetch the specific row
    const rows = await getContentRepoData(accessToken);
    const row = rows.find((r) => r.rowIndex === rowIndex);

    if (!row) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    }

    console.log(`[Auto-publish] Processing specific row ${rowIndex}: ${row.title || row.blogPost}`);
    const result = await publishRow(accessToken, row);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Auto-publish] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-publish failed' },
      { status: 500 }
    );
  }
}
