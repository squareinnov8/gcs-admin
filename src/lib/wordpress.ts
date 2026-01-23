import { WordPressPost, PublishResult } from '@/types';

const getAuthHeader = () => {
  const username = process.env.WORDPRESS_USERNAME;
  const password = process.env.WORDPRESS_APP_PASSWORD;

  if (!username || !password) {
    throw new Error('WordPress credentials not configured');
  }

  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
};

const getApiUrl = (endpoint: string) => {
  const baseUrl = process.env.WORDPRESS_URL;
  if (!baseUrl) {
    throw new Error('WORDPRESS_URL not configured');
  }
  return `${baseUrl}/wp-json/wp/v2/${endpoint}`;
};

export async function createPost(post: WordPressPost): Promise<PublishResult> {
  try {
    // Build the post data, only including defined fields
    const postData: Record<string, any> = {
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      status: post.status,
    };

    if (post.slug) postData.slug = post.slug;
    if (post.author) postData.author = post.author;
    if (post.date) postData.date = post.date;
    if (post.categories) postData.categories = post.categories;
    if (post.tags) postData.tags = post.tags;
    if (post.format) postData.format = post.format;
    if (post.featured_media) postData.featured_media = post.featured_media;
    if (post.meta) postData.meta = post.meta;

    const response = await fetch(getApiUrl('posts'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WordPress API error: ${response.status} - ${error}`);
    }

    const result = await response.json();

    return {
      success: true,
      postId: result.id,
      postUrl: result.link,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updatePost(
  postId: number,
  post: Partial<WordPressPost>
): Promise<PublishResult> {
  try {
    const response = await fetch(getApiUrl(`posts/${postId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(post),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WordPress API error: ${response.status} - ${error}`);
    }

    const result = await response.json();

    return {
      success: true,
      postId: result.id,
      postUrl: result.link,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getCategories(): Promise<Array<{ id: number; name: string; slug: string }>> {
  const response = await fetch(getApiUrl('categories?per_page=100'), {
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch categories');
  }

  return response.json();
}

export async function createCategory(name: string): Promise<{ id: number; name: string; slug: string }> {
  const response = await fetch(getApiUrl('categories'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to create category');
  }

  return response.json();
}

export async function getTags(): Promise<Array<{ id: number; name: string; slug: string }>> {
  const response = await fetch(getApiUrl('tags?per_page=100'), {
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tags');
  }

  return response.json();
}

export async function createTag(name: string): Promise<{ id: number; name: string; slug: string }> {
  const response = await fetch(getApiUrl('tags'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to create tag');
  }

  return response.json();
}

export async function getOrCreateCategory(name: string): Promise<number> {
  const categories = await getCategories();
  const existing = categories.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );

  if (existing) {
    return existing.id;
  }

  const newCategory = await createCategory(name);
  return newCategory.id;
}

export async function getOrCreateTags(names: string[]): Promise<number[]> {
  const existingTags = await getTags();
  const tagIds: number[] = [];

  for (const name of names) {
    const existing = existingTags.find(
      (t) => t.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      tagIds.push(existing.id);
    } else {
      const newTag = await createTag(name);
      tagIds.push(newTag.id);
    }
  }

  return tagIds;
}

export interface MediaUploadResult {
  success: boolean;
  mediaId?: number;
  mediaUrl?: string;
  error?: string;
}

/**
 * Uploads an image to the WordPress media library
 */
export async function uploadMedia(
  imageBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<MediaUploadResult> {
  try {
    const baseUrl = process.env.WORDPRESS_URL;
    if (!baseUrl) {
      throw new Error('WORDPRESS_URL not configured');
    }

    // Convert Buffer to Uint8Array for fetch compatibility
    const uint8Array = new Uint8Array(imageBuffer);

    // WordPress expects the Content-Disposition header with filename
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
      body: uint8Array,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `WordPress media upload failed: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();

    return {
      success: true,
      mediaId: result.id,
      mediaUrl: result.source_url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Media upload failed',
    };
  }
}

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(getApiUrl('users/me'), {
      headers: {
        Authorization: getAuthHeader(),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Authentication failed: ${error}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
