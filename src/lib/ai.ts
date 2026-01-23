import OpenAI from 'openai';
import { DocumentMetadata } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function extractMetadata(
  content: string,
  fileName: string
): Promise<DocumentMetadata> {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `Analyze the following blog article content and extract metadata. The file name is "${fileName}".

Return a JSON object with these fields:
- title: The best title for this article (clear, engaging, SEO-friendly)
- description: A 1-2 sentence description of the article
- excerpt: A compelling excerpt (2-3 sentences) for previews/social sharing
- category: The main category this article belongs to. Choose ONE from: "Personal Finance", "Investing", "Budgeting", "Credit", "Retirement", "Taxes", "Insurance", "Real Estate", "Career", "Lifestyle", "General"
- tags: An array of 3-7 relevant tags (lowercase, can be multi-word phrases like "emergency fund", "credit score")
- author: Suggest an author name or use "CommonCents Team"
- seoTitle: An SEO-optimized title (50-60 characters max)
- seoDescription: An SEO-optimized meta description (150-160 characters max)

Article content:
${content.slice(0, 15000)}

Respond with ONLY the JSON object, no additional text or markdown formatting.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: 1024,
  });

  const textContent = response.choices[0]?.message?.content;
  if (!textContent) {
    throw new Error('No response from OpenAI');
  }

  try {
    let jsonStr = textContent.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Build complete metadata with defaults
    const metadata: DocumentMetadata = {
      title: parsed.title || fileName.replace(/\.[^/.]+$/, ''),
      slug: generateSlug(parsed.title || fileName),
      description: parsed.description || '',
      excerpt: parsed.excerpt || parsed.description || '',
      category: parsed.category || 'General',
      tags: parsed.tags || [],
      author: parsed.author || 'CommonCents Team',
      publishDate: today,
      seoTitle: parsed.seoTitle || parsed.title?.slice(0, 60) || '',
      seoDescription: parsed.seoDescription || parsed.description?.slice(0, 160) || '',
      format: 'standard',
    };

    return metadata;
  } catch (error) {
    console.error('Failed to parse OpenAI response:', textContent);
    throw new Error('Failed to parse metadata from OpenAI response');
  }
}

export async function improveContent(content: string): Promise<string> {
  const prompt = `Review and improve the following blog article content. Fix any grammar issues, improve clarity, and ensure it's well-structured. Keep the same general content and style, just polish it.

Return ONLY the improved content, no explanations or markdown formatting.

Article content:
${content}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: 4096,
  });

  const textContent = response.choices[0]?.message?.content;
  if (!textContent) {
    throw new Error('No response from OpenAI');
  }

  return textContent.trim();
}
