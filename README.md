# CommonCents Blog Admin

A Next.js application that automates publishing blog articles from Google Drive to WordPress with AI-powered metadata extraction.

## Features

- **Google Drive Integration**: Sync documents from a specified folder
- **Multi-format Support**: Process Google Docs, Word (.docx), PDF, and Markdown files
- **AI Metadata Extraction**: Uses Claude to automatically generate titles, descriptions, categories, tags, and SEO metadata
- **WordPress Publishing**: Publish articles as drafts or directly to your WordPress site
- **Admin Dashboard**: Review, edit metadata, and manage your publishing workflow

## Prerequisites

- Node.js 18+
- A Google Cloud project with Drive API enabled
- A WordPress site with REST API access
- An Anthropic API key

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   cd blog-admin
   npm install
   ```

2. **Copy environment file and configure:**
   ```bash
   cp .env.example .env
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open http://localhost:3000**

## Configuration

### Google Drive Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the Google Drive API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client IDs
5. Configure the OAuth consent screen
6. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Secret to your `.env` file

**Get your Google Drive Folder ID:**
1. Open Google Drive and navigate to your blog folder
2. The folder ID is in the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`
3. Add it to `GOOGLE_DRIVE_FOLDER_ID` in `.env`

### WordPress Setup

1. Log into your WordPress admin
2. Go to Users → Profile
3. Scroll down to "Application Passwords"
4. Enter a name (e.g., "Blog Admin") and click "Add New"
5. Copy the generated password (you won't see it again!)
6. Add to `.env`:
   - `WORDPRESS_URL`: Your site URL (e.g., `https://yourblog.com`)
   - `WORDPRESS_USERNAME`: Your WordPress username
   - `WORDPRESS_APP_PASSWORD`: The application password (remove spaces)

### Claude API Setup

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Add to `ANTHROPIC_API_KEY` in `.env`

## Usage

### Workflow

1. **Add documents** to your Google Drive folder
2. **Sign in** to the admin dashboard with Google
3. **Click "Process"** on any document to:
   - Extract content from the document
   - Generate metadata using Claude AI
4. **Review & Edit** the generated metadata
5. **Publish** as draft or directly to WordPress

### Supported Document Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Google Docs | - | Exported as HTML |
| Microsoft Word | .docx | Converted to HTML |
| PDF | .pdf | Text extracted |
| Markdown | .md | Frontmatter stripped, rendered |

## Project Structure

```
blog-admin/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/  # NextAuth.js routes
│   │   │   ├── documents/           # Document processing
│   │   │   ├── publish/             # WordPress publishing
│   │   │   └── wordpress/           # WordPress test endpoint
│   │   ├── login/                   # Login page
│   │   ├── settings/                # Settings page
│   │   ├── layout.tsx
│   │   └── page.tsx                 # Main dashboard
│   ├── components/
│   │   ├── DocumentCard.tsx
│   │   ├── DocumentModal.tsx
│   │   ├── Header.tsx
│   │   └── Providers.tsx
│   ├── lib/
│   │   ├── claude.ts               # Claude API integration
│   │   ├── document-processor.ts    # Multi-format processor
│   │   ├── google-drive.ts          # Google Drive API
│   │   └── wordpress.ts             # WordPress REST API
│   └── types/
│       └── index.ts
├── .env.example
├── package.json
└── README.md
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXTAUTH_URL` | Your app URL (http://localhost:3000 for dev) |
| `NEXTAUTH_SECRET` | Random secret for session encryption |
| `ADMIN_EMAIL` | Email for credential-based login |
| `ADMIN_PASSWORD` | Password for credential-based login |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_DRIVE_FOLDER_ID` | ID of the Drive folder to sync |
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `WORDPRESS_URL` | Your WordPress site URL |
| `WORDPRESS_USERNAME` | WordPress username |
| `WORDPRESS_APP_PASSWORD` | WordPress application password |

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables
4. Update `NEXTAUTH_URL` to your Vercel URL
5. Add Vercel URL to Google OAuth authorized redirect URIs

## Future Enhancements

- [ ] Automatic document sync (webhook/polling)
- [ ] Image upload to WordPress media library
- [ ] Scheduled publishing
- [ ] Multiple WordPress site support
- [ ] Document versioning
- [ ] Team collaboration features

## License

MIT
