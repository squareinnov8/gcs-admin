import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocumentContent, downloadFile, extractDriveFileId } from '@/lib/google-drive';
import { processDocument, extractTitleFromContent } from '@/lib/document-processor';
import { extractMetadata } from '@/lib/ai';
import { getContentRepoData, sheetRowsToDocuments, sheetRowToMetadata } from '@/lib/google-sheets';
import { downloadFeaturedImage } from '@/lib/featured-image';
import { Document, DocumentMetadata } from '@/types';

// Helper to generate URL-safe slugs
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// In-memory store for processed documents (in production, use a database)
const processedDocuments = new Map<string, Document>();

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google Drive not connected. Please sign in with Google.' },
      { status: 400 }
    );
  }

  try {
    // Load documents from Content Repo sheet instead of Drive
    const sheetRows = await getContentRepoData(accessToken);
    const documents = sheetRowsToDocuments(sheetRows);

    // Merge with any locally processed documents (for content/images loaded this session)
    const enrichedDocuments = documents.map((doc) => {
      const processed = processedDocuments.get(doc.id);
      if (processed) {
        // Merge processed content with sheet data
        return {
          ...doc,
          ...processed,
          // Keep sheet metadata but allow processed overrides
          metadata: { ...doc.metadata, ...processed.metadata },
        };
      }
      return doc;
    });

    return NextResponse.json({ documents: enrichedDocuments });
  } catch (error) {
    console.error('Error listing documents:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list documents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google Drive not connected' },
      { status: 400 }
    );
  }

  try {
    const { documentId } = await request.json();

    // Get document from sheet-based list
    const sheetRows = await getContentRepoData(accessToken);
    const documents = sheetRowsToDocuments(sheetRows);
    const doc = documents.find((d) => d.id === documentId);

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Find the corresponding sheet row for the blogPost/Drive link
    const sheetRow = sheetRows.find((r) => `sheet-${r.rowIndex}` === documentId);
    if (!sheetRow) {
      return NextResponse.json({ error: 'Sheet row not found' }, { status: 404 });
    }

    // Column I (blogLink) contains the Drive link to the document
    let driveFileId = extractDriveFileId(sheetRow.blogLink);

    // If blogLink doesn't contain a valid Drive link, check if it's a raw file ID
    if (!driveFileId && sheetRow.blogLink) {
      if (/^[a-zA-Z0-9_-]{20,}$/.test(sheetRow.blogLink.trim())) {
        driveFileId = sheetRow.blogLink.trim();
      }
    }

    let content = '';
    let extractedTitle: string | null = null;

    if (driveFileId) {
      // Get content from Google Drive
      try {
        const rawHtml = await getDocumentContent(accessToken, driveFileId, 'application/vnd.google-apps.document');
        content = await processDocument(rawHtml, 'application/vnd.google-apps.document', doc.name);

        // Extract title from first heading and remove it from content
        const titleResult = extractTitleFromContent(content);
        extractedTitle = titleResult.title;
        content = titleResult.contentWithoutTitle;
      } catch (driveError) {
        console.warn('Could not fetch content from Drive:', driveError);
        // Continue without content - user can still publish with metadata
      }
    }

    // Build metadata from sheet (already populated in doc.metadata)
    const metadata: DocumentMetadata = {
      ...doc.metadata!,
      // Override title with extracted heading if we got one and sheet doesn't have one
      title: doc.metadata?.title || extractedTitle || sheetRow.title || doc.name,
      slug: doc.metadata?.slug || generateSlug(doc.metadata?.title || extractedTitle || sheetRow.title || doc.name),
    };

    // Download featured image from Drive if we have a photoLink
    if (metadata.photoLink) {
      try {
        console.log(`Downloading featured image from: ${metadata.photoLink}`);
        const imageResult = await downloadFeaturedImage(accessToken, metadata.photoLink);

        if (imageResult.success && imageResult.data) {
          metadata.featuredImageData = imageResult.data;
          metadata.featuredImageMimeType = imageResult.mimeType;
          metadata.featuredImageName = imageResult.filename;
          console.log(`Featured image downloaded: ${imageResult.filename}`);
        } else {
          console.warn(`Featured image download failed: ${imageResult.error}`);
        }
      } catch (imageError) {
        console.error('Featured image download error:', imageError);
        // Don't fail processing if image download fails
      }
    }

    // Store processed document
    const processedDoc: Document = {
      ...doc,
      status: 'processed',
      content,
      metadata,
      sheetRowIndex: sheetRow.rowIndex,
    };

    processedDocuments.set(documentId, processedDoc);

    return NextResponse.json({ document: processedDoc });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process document' },
      { status: 500 }
    );
  }
}

// PATCH - Update document with WordPress info after publishing
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { documentId, wpPostId, wpPostUrl, wpStatus } = await request.json();

    const doc = processedDocuments.get(documentId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Update the document with WordPress info
    const updatedDoc: Document = {
      ...doc,
      status: 'published',
      wpPostId,
      wpPostUrl,
      wpStatus,
      wpPublishedAt: new Date().toISOString(),
    };

    processedDocuments.set(documentId, updatedDoc);

    return NextResponse.json({ document: updatedDoc });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update document' },
      { status: 500 }
    );
  }
}
