import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCategories, getTags } from '@/lib/wordpress';
import { WordPressCategory, WordPressUser, WordPressTag } from '@/types';

const getAuthHeader = () => {
  const username = process.env.WORDPRESS_USERNAME;
  const password = process.env.WORDPRESS_APP_PASSWORD;
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
};

async function getUsers(): Promise<WordPressUser[]> {
  const baseUrl = process.env.WORDPRESS_URL;
  const response = await fetch(`${baseUrl}/wp-json/wp/v2/users?per_page=100`, {
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!response.ok) {
    return [];
  }

  const users = await response.json();
  return users.map((u: any) => ({
    id: u.id,
    name: u.name,
    slug: u.slug,
  }));
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [categories, tags, users] = await Promise.all([
      getCategories(),
      getTags(),
      getUsers(),
    ]);

    return NextResponse.json({
      categories,
      tags,
      users,
    });
  } catch (error) {
    console.error('Error fetching WordPress data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WordPress data' },
      { status: 500 }
    );
  }
}
