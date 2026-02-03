import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

/**
 * Gets a fresh Google access token using a stored refresh token.
 * Used by cron jobs that don't have a user session.
 * Requires GOOGLE_REFRESH_TOKEN environment variable.
 */
export async function getAccessTokenFromRefreshToken(): Promise<string | null> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    console.warn('GOOGLE_REFRESH_TOKEN not set — cron cannot access Google APIs');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Refresh token exchange failed:', data);
      return null;
    }

    return data.access_token;
  } catch (error) {
    console.error('Failed to get access token from refresh token:', error);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    CredentialsProvider({
      name: 'Admin Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        if (
          credentials.email === process.env.ADMIN_EMAIL &&
          credentials.password === process.env.ADMIN_PASSWORD
        ) {
          return {
            id: '1',
            email: credentials.email,
            name: 'Admin',
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // On initial sign-in, capture all token data
      if (account) {
        // TODO: Remove after capturing refresh token for GOOGLE_REFRESH_TOKEN env var
        console.log('[AUTH] Refresh token for env var:', account.refresh_token);
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      // Return existing token if not expired (with 60s buffer)
      if (Date.now() < ((token.expiresAt as number) * 1000 - 60000)) {
        return token;
      }

      // Token is expired or about to expire — refresh it
      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken as string,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw data;
        }

        return {
          ...token,
          accessToken: data.access_token,
          expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
          // Google may rotate refresh tokens; use new one if provided
          refreshToken: data.refresh_token ?? token.refreshToken,
        };
      } catch (error) {
        console.error('Token refresh failed:', error);
        return { ...token, error: 'RefreshTokenError' };
      }
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};
