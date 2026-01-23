import mammoth from 'mammoth';
import { Document } from '@/types';

export async function processDocument(
  content: string | Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  switch (mimeType) {
    case 'application/vnd.google-apps.document':
      // Google Docs are exported as HTML - needs special handling
      return cleanGoogleDocsHtml(content as string);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return await processWordDocument(content as Buffer);

    case 'application/pdf':
      return await processPdfDocument(content as Buffer);

    case 'text/markdown':
    case 'text/x-markdown':
      return processMarkdown(content.toString());

    case 'text/plain':
      return content.toString();

    default:
      // Try to handle as text if possible
      if (fileName.endsWith('.md')) {
        return processMarkdown(content.toString());
      }
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

function cleanGoogleDocsHtml(html: string): string {
  // Google Docs exports include a full HTML document with head, styles, etc.
  // Extract just the body content
  let content = html;

  // Extract body content if it's a full HTML document
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  }

  // Remove Google Docs specific elements
  // Remove the document title that Google adds at the top
  content = content.replace(/<p[^>]*class="[^"]*title[^"]*"[^>]*>[\s\S]*?<\/p>/gi, '');
  content = content.replace(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>[\s\S]*?<\/h1>/gi, '');

  // Remove Google Docs specific divs and wrappers
  content = content.replace(/<div[^>]*class="[^"]*doc-content[^"]*"[^>]*>/gi, '');

  // Now apply standard cleaning
  return cleanHtml(content);
}

async function processWordDocument(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return cleanHtml(result.value);
}

async function processPdfDocument(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid issues with pdf-parse in Next.js
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

function processMarkdown(content: string): string {
  // Strip frontmatter if present
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
  return content.replace(frontmatterRegex, '').trim();
}

function cleanHtml(html: string): string {
  // Step 1: Remove common meta information sections at the end
  // These patterns catch meta sections with various headings
  let cleaned = html;

  // Remove horizontal rules and everything after (often used to separate meta)
  cleaned = cleaned.replace(/<hr[^>]*>[\s\S]*$/gi, '');

  // Remove sections that start with meta-related headings
  const metaHeadings = [
    'meta information', 'meta info', 'article meta', 'post meta',
    'seo information', 'seo info', 'seo details', 'seo',
    'metadata', 'meta data', 'article information',
    'keywords', 'tags', 'categories',
    'notes', 'internal notes', 'editor notes',
    '---' // horizontal line in text form
  ];

  for (const heading of metaHeadings) {
    // Match heading in paragraph
    const pPattern = new RegExp(`<p[^>]*>[\\s]*${heading.replace(/\s+/g, '\\s*')}[\\s]*:?[\\s]*<\\/p>[\\s\\S]*$`, 'gi');
    cleaned = cleaned.replace(pPattern, '');

    // Match heading in any heading tag
    const hPattern = new RegExp(`<h\\d[^>]*>[\\s]*${heading.replace(/\s+/g, '\\s*')}[\\s]*:?[\\s]*<\\/h\\d>[\\s\\S]*$`, 'gi');
    cleaned = cleaned.replace(hPattern, '');

    // Match as bold text starting a paragraph
    const bPattern = new RegExp(`<p[^>]*>[\\s]*<(?:strong|b)>[\\s]*${heading.replace(/\s+/g, '\\s*')}[\\s]*:?[\\s]*<\\/(?:strong|b)>[\\s\\S]*$`, 'gi');
    cleaned = cleaned.replace(bPattern, '');
  }

  // Also remove any trailing content after common separator patterns
  cleaned = cleaned.replace(/[-_=]{3,}[\s\S]*$/g, '');
  cleaned = cleaned.replace(/\*{3,}[\s\S]*$/g, '');

  // Step 2: Remove everything except allowed tags
  // Allowed: p, h1-h6, strong, b, em, i, ul, ol, li, br, a (with href only)

  // Remove script and style tags with their content
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove all attributes except href on anchor tags
  // First, preserve href on anchors
  cleaned = cleaned.replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>/gi, '<a href="$1">');

  // Remove all attributes from other tags
  cleaned = cleaned.replace(/<(p|h[1-6]|strong|b|em|i|ul|ol|li|br|div|span)\s+[^>]*>/gi, '<$1>');

  // Convert div and span to appropriate elements or remove
  cleaned = cleaned.replace(/<div[^>]*>/gi, '<p>');
  cleaned = cleaned.replace(/<\/div>/gi, '</p>');
  cleaned = cleaned.replace(/<span[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/span>/gi, '');

  // Remove any remaining disallowed tags but keep their content
  const allowedTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'br', 'a'];
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  cleaned = cleaned.replace(tagPattern, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match;
    }
    return '';
  });

  // Step 3: Clean up whitespace
  // Replace multiple spaces with single space
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  // Remove spaces at the start/end of tags
  cleaned = cleaned.replace(/>\s+/g, '>');
  cleaned = cleaned.replace(/\s+</g, '<');

  // Fix empty paragraphs
  cleaned = cleaned.replace(/<p><\/p>/gi, '');
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');

  // Fix multiple consecutive breaks
  cleaned = cleaned.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');

  // Fix multiple consecutive paragraphs with just whitespace between
  cleaned = cleaned.replace(/(<\/p>\s*<p>)+/gi, '</p><p>');

  // Ensure proper paragraph spacing for WordPress
  cleaned = cleaned.replace(/<\/p><p>/g, '</p>\n\n<p>');
  cleaned = cleaned.replace(/<\/h(\d)><p>/g, '</h$1>\n\n<p>');
  cleaned = cleaned.replace(/<\/p><h(\d)>/g, '</p>\n\n<h$1>');

  // Step 4: Remove any leading/trailing non-content
  // Remove everything before the first real content tag
  cleaned = cleaned.replace(/^[^<]*/, '');

  // Trim and return
  return cleaned.trim();
}

export interface TitleExtractionResult {
  title: string | null;
  contentWithoutTitle: string;
}

/**
 * Extracts the title from the first H1 or H2 heading and removes it from content
 * to prevent duplicate titles when WordPress adds its own title
 */
export function extractTitleFromContent(html: string): TitleExtractionResult {
  // Try to find H1 first, then H2
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);

  // Prefer H1, fall back to H2
  const match = h1Match || h2Match;

  if (!match) {
    return {
      title: null,
      contentWithoutTitle: html,
    };
  }

  // Extract text content from the heading, stripping any inner tags
  const titleHtml = match[1];
  const title = titleHtml
    .replace(/<[^>]+>/g, '') // Remove any nested tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  // Remove the heading from content
  const contentWithoutTitle = html.replace(match[0], '').trim();

  return {
    title: title || null,
    contentWithoutTitle,
  };
}

export function extractFrontmatter(content: string): Record<string, string> | null {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) return null;

  const frontmatter: Record<string, string> = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}
