# CLAUDE.md - CommonCents Blog Admin

## Project Overview

This is a Next.js admin application for automating blog publishing from Google Drive to WordPress with AI-powered metadata extraction.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: NextAuth.js (Google OAuth + Credentials)
- **APIs**: Google Drive, Anthropic Claude, WordPress REST API

## Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## Architecture

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/google-drive.ts` | Google Drive API wrapper |
| `src/lib/document-processor.ts` | Multi-format document parsing |
| `src/lib/claude.ts` | Claude AI metadata extraction |
| `src/lib/wordpress.ts` | WordPress REST API client |
| `src/app/api/documents/route.ts` | Document listing & processing |
| `src/app/api/publish/route.ts` | WordPress publishing |

### Data Flow

1. User authenticates with Google OAuth
2. App lists documents from configured Drive folder
3. User clicks "Process" → downloads & extracts content
4. Claude analyzes content → generates metadata
5. User reviews/edits metadata in modal
6. User clicks "Publish" → creates WordPress post

## Environment Setup

Required environment variables (see `.env.example`):

- `NEXTAUTH_*` - Authentication config
- `GOOGLE_*` - Google OAuth and Drive folder
- `ANTHROPIC_API_KEY` - Claude API
- `WORDPRESS_*` - WordPress site credentials

## Code Patterns

### API Routes

All API routes use Next.js App Router pattern:
- Check session with `getServerSession(authOptions)`
- Return `NextResponse.json()` for all responses

### Type Safety

Document types defined in `src/types/index.ts`:
- `Document` - Google Drive file + processing status
- `DocumentMetadata` - AI-extracted metadata
- `WordPressPost` - WordPress post structure

### Error Handling

- API routes return `{ error: string }` with appropriate status codes
- Client components display errors in UI with alert dialogs

## Important Notes

- Documents are stored in-memory (Map) during session - production should use a database
- Google OAuth requires proper scopes for Drive access
- WordPress requires Application Password, not regular password
