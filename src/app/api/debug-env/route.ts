import { NextResponse } from 'next/server';

// Temporary debug endpoint - DELETE AFTER TROUBLESHOOTING
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const nextauthUrl = process.env.NEXTAUTH_URL || '';

  return NextResponse.json({
    GOOGLE_CLIENT_ID: {
      length: clientId.length,
      first20: clientId.substring(0, 20),
      last10: clientId.substring(clientId.length - 10),
      hasWhitespace: clientId !== clientId.trim(),
      hasNewline: clientId.includes('\n') || clientId.includes('\r'),
    },
    GOOGLE_CLIENT_SECRET: {
      length: clientSecret.length,
      first10: clientSecret.substring(0, 10),
      last4: clientSecret.substring(clientSecret.length - 4),
      hasWhitespace: clientSecret !== clientSecret.trim(),
      hasNewline: clientSecret.includes('\n') || clientSecret.includes('\r'),
    },
    NEXTAUTH_URL: nextauthUrl,
    NODE_ENV: process.env.NODE_ENV,
  });
}
