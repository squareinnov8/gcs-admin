import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createPost, updatePost, getOrCreateCategory, getOrCreateTags } from '@/lib/wordpress';
import { uploadFeaturedImage } from '@/lib/featured-image';
import { updateRowAfterPublish } from '@/lib/google-sheets';
import { Document, DocumentMetadata, WordPressPost } from '@/types';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      document,
      status = 'draft',
      overrideMetadata,
    }: {
      document: Document;
      status: 'draft' | 'publish';
      overrideMetadata?: Partial<DocumentMetadata>;
    } = body;

    if (!document.content || !document.metadata) {
      return NextResponse.json(
        { error: 'Document must be processed before publishing' },
        { status: 400 }
      );
    }

    const metadata = { ...document.metadata, ...overrideMetadata };

    // Handle featured image - upload pre-downloaded image to WordPress
    let featuredMediaId: number | undefined = metadata.featuredImageId;

    if (!featuredMediaId && metadata.featuredImageData && metadata.featuredImageName && metadata.featuredImageMimeType) {
      try {
        console.log(`Uploading featured image to WordPress: ${metadata.featuredImageName}`);
        const uploadResult = await uploadFeaturedImage(
          metadata.featuredImageData,
          metadata.featuredImageName,
          metadata.featuredImageMimeType
        );

        if (uploadResult.success && uploadResult.mediaId) {
          featuredMediaId = uploadResult.mediaId;
          console.log(`Featured image uploaded to WordPress: ID ${featuredMediaId}`);
        } else {
          console.warn(`Featured image upload failed: ${uploadResult.error}`);
          // Don't block publishing if image upload fails
        }
      } catch (imageError) {
        console.error('Featured image upload error:', imageError);
        // Don't block publishing if image upload fails
      }
    }

    // Get or create category
    const categoryId = await getOrCreateCategory(metadata.category);

    // Get or create tags
    const tagIds = metadata.tags.length > 0
      ? await getOrCreateTags(metadata.tags)
      : [];

    // Only set date if we're scheduling for a future date
    // When publishing immediately (status='publish'), don't pass date - WordPress uses current time
    let publishDate: string | undefined = undefined;
    if (metadata.publishDate) {
      const scheduledDate = new Date(`${metadata.publishDate}T12:00:00`);
      const now = new Date();
      // Only set date if it's in the future (for scheduling)
      if (scheduledDate > now) {
        publishDate = `${metadata.publishDate}T12:00:00`;
      }
    }

    // Build WordPress post with all fields
    const post: WordPressPost = {
      title: metadata.title,
      content: document.content,
      excerpt: metadata.excerpt,
      slug: metadata.slug,
      status,
      author: metadata.authorId,
      date: publishDate, // undefined = publish now, future date = schedule
      categories: [categoryId],
      tags: tagIds,
      featured_media: featuredMediaId,
      format: metadata.format || 'standard',
      meta: {
        // Yoast SEO fields
        _yoast_wpseo_title: metadata.seoTitle || metadata.title,
        _yoast_wpseo_metadesc: metadata.seoDescription || metadata.excerpt,
      },
    };

    // Check if this document already has a WordPress post - update instead of create
    let result;
    const isUpdate = !!document.wpPostId;

    if (document.wpPostId) {
      result = await updatePost(document.wpPostId, post);
    } else {
      result = await createPost(post);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Update Google Sheet with WordPress info (Column H = Status, Column K = WP ID)
    const accessToken = (session as any).accessToken;
    if (document.sheetRowIndex && accessToken && result.postId) {
      try {
        const sheetStatus = status === 'publish' ? 'Published' : 'Draft';
        await updateRowAfterPublish(
          accessToken,
          document.sheetRowIndex,
          sheetStatus,
          result.postId
        );
        console.log(`Updated sheet row ${document.sheetRowIndex} with WordPress ID ${result.postId}`);
      } catch (sheetError) {
        console.error('Failed to update sheet:', sheetError);
        // Don't fail the publish if sheet update fails
      }
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      postUrl: result.postUrl,
      isUpdate,
      wpStatus: status,
    });
  } catch (error) {
    console.error('Error publishing document:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish' },
      { status: 500 }
    );
  }
}
