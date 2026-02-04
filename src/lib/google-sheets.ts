import { google } from 'googleapis';
import { getGoogleAuth } from './google-drive';
import { Document } from '@/types';

// Sheet ID from environment
const SHEET_ID = process.env.GOOGLE_SHEETS_ID || '1L5KUiI3d0Wx-drx17Jq_xBSTUTSI9rqIxvAxnFrjCpo';

// Column mapping for "CommonCents Content Repo"
// A=Blog Post (name), B=Title, C=Category, D=Meta Title, E=Meta Description,
// F=Slug, G=Primary Keyword, H=Featured Image Alt, I=Status, J=Post Date,
// K=Blog Link (Drive doc URL), L=Photo Link, M=WordPress ID
export interface SheetRow {
  rowIndex: number;      // 1-based row index in sheet (for updates)
  blogPost: string;      // Column A - document name in Drive
  title: string;         // Column B
  category: string;      // Column C
  metaTitle: string;     // Column D
  metaDescription: string; // Column E
  slug: string;          // Column F
  primaryKeyword: string; // Column G
  featuredImageAlt: string; // Column H
  status: string;        // Column I
  postDate: string;      // Column J
  blogLink: string;      // Column K
  photoLink: string;     // Column L - Google Drive link to featured image
  wordpressId: string;   // Column M - WordPress post ID
}

async function getSheetsClient(accessToken: string) {
  const auth = getGoogleAuth();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Fetches all rows from the Content Repo sheet
 */
export async function getContentRepoData(accessToken: string): Promise<SheetRow[]> {
  const sheets = await getSheetsClient(accessToken);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'A:M', // Columns A through M
    });

    const rows = response.data.values || [];

    // Skip header row (index 0)
    if (rows.length <= 1) {
      return [];
    }

    return rows.slice(1).map((row, index) => ({
      rowIndex: index + 2, // +2 because we skip header (1) and arrays are 0-indexed
      blogPost: row[0] || '',
      title: row[1] || '',
      category: row[2] || '',
      metaTitle: row[3] || '',
      metaDescription: row[4] || '',
      slug: row[5] || '',
      primaryKeyword: row[6] || '',
      featuredImageAlt: row[7] || '',
      status: row[8] || '',
      postDate: row[9] || '',
      blogLink: row[10] || '',
      photoLink: row[11] || '',
      wordpressId: row[12] || '',
    }));
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw new Error('Failed to fetch data from Google Sheets. Make sure you have access to the Content Repo.');
  }
}

/**
 * Updates a row's status and WordPress ID after publishing
 * Column I = Status, Column M = WordPress ID
 */
export async function updateRowAfterPublish(
  accessToken: string,
  rowIndex: number,
  status: string,
  wordpressId: number
): Promise<void> {
  const sheets = await getSheetsClient(accessToken);

  try {
    // Update columns I (status) and M (WordPress ID)
    const updates: { range: string; values: string[][] }[] = [
      {
        range: `I${rowIndex}`,
        values: [[status]],
      },
      {
        range: `M${rowIndex}`,
        values: [[wordpressId.toString()]],
      },
    ];

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });

    console.log(`Updated sheet row ${rowIndex}: status="${status}", wpId=${wordpressId}`);
  } catch (error) {
    console.error('Error updating sheet:', error);
    throw new Error('Failed to update Content Repo sheet');
  }
}

/**
 * Converts sheet rows to Document objects for admin listing
 */
export function sheetRowsToDocuments(rows: SheetRow[]): Document[] {
  return rows
    .filter((row) => row.title || row.blogPost) // Must have at least a title or blogPost name
    .map((row) => {
      // Determine status based on sheet data
      let status: Document['status'] = 'pending';
      const sheetStatus = row.status.toLowerCase().replace(/\s+/g, '');

      if (row.wordpressId || sheetStatus === 'published' || sheetStatus === 'posted' || sheetStatus === 'live') {
        status = 'published';
      } else if (sheetStatus === 'draft') {
        status = 'processed';
      } else if (sheetStatus === 'ready' || sheetStatus === 'readytopost') {
        status = 'processed';
      }

      return {
        id: `sheet-${row.rowIndex}`, // Unique ID based on row
        name: row.blogPost || row.title,
        mimeType: 'application/vnd.google-apps.document', // Assume Google Doc
        createdTime: row.postDate ? new Date(row.postDate).toISOString() : new Date().toISOString(),
        modifiedTime: row.postDate ? new Date(row.postDate).toISOString() : new Date().toISOString(),
        status,
        wpPostId: row.wordpressId ? parseInt(row.wordpressId) : undefined,
        wpPostUrl: row.blogLink || undefined,
        // Store sheet row data for later use
        metadata: {
          title: row.title,
          slug: row.slug,
          description: row.metaDescription,
          excerpt: row.metaDescription,
          category: row.category || 'General',
          tags: row.primaryKeyword ? [row.primaryKeyword] : [],
          author: 'CommonCents Team',
          publishDate: new Date().toISOString().split('T')[0],
          seoTitle: row.metaTitle,
          seoDescription: row.metaDescription,
          photoLink: row.photoLink,
          format: 'standard',
          metadataSource: 'sheet',
        },
        // Store row index for updates
        sheetRowIndex: row.rowIndex,
      } as Document & { sheetRowIndex: number };
    });
}

/**
 * Normalizes a string for comparison (lowercase, trim, remove extension)
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\.[^/.]+$/, '') // Remove file extension
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars except spaces
    .replace(/\s+/g, ' '); // Normalize spaces
}

/**
 * Finds a sheet row matching the document name
 * Matches against Column A (Blog Post) or Column B (Title)
 */
export async function findRowByDocumentName(
  accessToken: string,
  documentName: string
): Promise<SheetRow | null> {
  const rows = await getContentRepoData(accessToken);
  const normalizedName = normalizeForComparison(documentName);

  // First try exact match on blogPost (Column A)
  let match = rows.find(
    (row) => normalizeForComparison(row.blogPost) === normalizedName
  );

  if (match) {
    return match;
  }

  // Then try matching on title (Column B)
  match = rows.find(
    (row) => normalizeForComparison(row.title) === normalizedName
  );

  if (match) {
    return match;
  }

  // Try partial match on blogPost
  match = rows.find(
    (row) =>
      normalizeForComparison(row.blogPost).includes(normalizedName) ||
      normalizedName.includes(normalizeForComparison(row.blogPost))
  );

  if (match) {
    return match;
  }

  // Try partial match on title
  match = rows.find(
    (row) =>
      normalizeForComparison(row.title).includes(normalizedName) ||
      normalizedName.includes(normalizeForComparison(row.title))
  );

  return match || null;
}

/**
 * Converts a sheet row to DocumentMetadata format
 */
export function sheetRowToMetadata(row: SheetRow): Partial<{
  title: string;
  slug: string;
  category: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  photoLink: string;
}> {
  const metadata: Record<string, any> = {};

  if (row.title) metadata.title = row.title;
  if (row.slug) metadata.slug = row.slug;
  if (row.category) metadata.category = row.category;
  if (row.metaTitle) metadata.seoTitle = row.metaTitle;
  if (row.metaDescription) metadata.seoDescription = row.metaDescription;
  if (row.primaryKeyword) metadata.tags = [row.primaryKeyword];
  if (row.photoLink) metadata.photoLink = row.photoLink;

  return metadata;
}
