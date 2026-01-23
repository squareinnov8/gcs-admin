export interface Document {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  status: 'pending' | 'processed' | 'published' | 'error';
  content?: string;
  metadata?: DocumentMetadata;
  error?: string;
  // WordPress tracking
  wpPostId?: number;
  wpPostUrl?: string;
  wpStatus?: 'draft' | 'publish';
  wpPublishedAt?: string;
  // Sheet tracking
  sheetRowIndex?: number; // Row index in Content Repo for updates
}

export interface DocumentMetadata {
  title: string;
  slug: string;
  description: string;
  excerpt: string;
  category: string;
  tags: string[];
  author: string;
  authorId?: number;
  publishDate: string;
  featuredImage?: string;
  featuredImageId?: number; // WordPress media library ID
  photoLink?: string; // Google Drive link to featured image
  // Downloaded image data for preview (populated during processing)
  featuredImageData?: string; // Base64 encoded image data
  featuredImageMimeType?: string; // e.g., 'image/jpeg'
  featuredImageName?: string; // Original filename
  seoTitle?: string;
  seoDescription?: string;
  format: 'standard' | 'aside' | 'gallery' | 'link' | 'image' | 'quote' | 'status' | 'video' | 'audio' | 'chat';
  // Source tracking
  metadataSource?: 'sheet' | 'ai' | 'manual';
}

export interface SheetRow {
  blogPost: string;
  title: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  primaryKeyword: string;
  status: string;
  blogLink: string;
  photoLink: string;
}

export interface WordPressPost {
  id?: number;
  title: string;
  content: string;
  excerpt: string;
  slug?: string;
  status: 'draft' | 'publish' | 'pending' | 'private';
  author?: number;
  date?: string;
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  format?: string;
  meta?: Record<string, string>;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

export interface WordPressUser {
  id: number;
  name: string;
  slug: string;
}

export interface WordPressTag {
  id: number;
  name: string;
  slug: string;
}

export interface ProcessingResult {
  success: boolean;
  document?: Document;
  error?: string;
}

export interface PublishResult {
  success: boolean;
  postId?: number;
  postUrl?: string;
  error?: string;
}

export interface SyncStatus {
  lastSync: string | null;
  documentsFound: number;
  documentsProcessed: number;
  errors: string[];
}

export interface WordPressData {
  categories: WordPressCategory[];
  users: WordPressUser[];
  tags: WordPressTag[];
}
