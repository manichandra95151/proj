# Secure Media Vault

A production-ready secure media library with signed uploads, row-scoped access, and expiring download links.

## Features

- **Secure Two-Phase Uploads**: Server-issued upload tickets prevent unauthorized uploads
- **Row-Level Security**: Users can only access their own files and explicitly shared content
- **Integrity Verification**: Client and server-side SHA-256 hash verification 
- **Expiring Download Links**: Short-lived signed URLs (90 seconds) for secure access
- **Real-time Upload Progress**: Interactive upload states with cancel/retry functionality
- **File Sharing**: Share read-only access with other users by email
- **Version-based Conflict Resolution**: Optimistic locking prevents data races
- **Comprehensive Audit Logging**: Track all download access for compliance
- **Production Security**: MIME type validation, path sanitization, and abuse prevention

## Architecture

- **Frontend**: React + TypeScript + Vite + Apollo Client + Tailwind CSS
- **Backend**: GraphQL Yoga + Node.js + TypeScript  
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **File Processing**: Supabase Edge Functions for server-side hashing
- **Security**: Row-Level Security (RLS) + Private storage buckets

## Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Supabase account

### 1. Clone and Install

```bash
git clone <repo-url>
cd secure-media-vault
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Go to Project Settings → API to get your keys
3. Run the database migration:
   ```bash
   # Copy the contents of supabase/migrations/create_schema.sql
   # Execute in your Supabase SQL editor
   ```

### 3. Create Storage Bucket

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `private`
3. Set bucket to **Private** (not public)
4. Update bucket policies to allow authenticated users

### 4. Deploy Edge Function

1. Create the hash-object Edge Function in Supabase
2. Copy contents from `supabase/functions/hash-object/index.ts`
3. Deploy via Supabase dashboard

### 5. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key  
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 6. Run Development Server

```bash
npm run dev
```

This starts both the React app (port 5173) and GraphQL server (port 4000).

## Security Model

### Upload Flow
1. Client requests upload ticket with file metadata
2. Server generates single-use ticket bound to user + file signature  
3. Client uploads directly to signed Supabase Storage URL
4. Client finalizes upload with SHA-256 hash
5. Server verifies file exists and hash matches via Edge Function
6. Asset marked as "ready" only after successful verification

### Access Control
- **Row-Level Security** enforced on all database tables
- **Private Storage** - no public bucket access 
- **Signed URLs** with 90-second expiry for downloads
- **Audit Logging** for all download access

### Data Integrity  
- **Client-side** SHA-256 hashing before upload
- **Server-side** hash verification via Edge Function
- **MIME type validation** using magic byte detection
- **Path sanitization** prevents directory traversal

## API Schema

### Key Operations

```graphql
# Request secure upload authorization
createUploadUrl(filename: String!, mime: String!, size: Int!): UploadTicket!

# Finalize upload with integrity check  
finalizeUpload(assetId: ID!, clientSha256: String!, version: Int!): Asset!

# Get short-lived download link
getDownloadUrl(assetId: ID!): DownloadLink!

# List user's files with pagination
myAssets(after: String, first: Int, q: String): AssetConnection!
```

### Error Handling

All mutations return proper GraphQL errors with extension codes:
- `UNAUTHENTICATED` - Invalid or missing auth token
- `FORBIDDEN` - Access denied by RLS policies  
- `VERSION_CONFLICT` - Optimistic locking conflict (409)
- `INTEGRITY_ERROR` - Hash verification failed
- `NOT_FOUND` - Resource doesn't exist or no access

## Testing Checklist

The application demonstrates these critical security behaviors:

✅ **Replay Protection**: Upload tickets are single-use and idempotent  
✅ **Hash Verification**: Wrong client hash → server marks file corrupt  
✅ **RLS Enforcement**: Users cannot access other users' files (403)  
✅ **TTL Respect**: Download URLs expire after 90 seconds  
✅ **Version Conflicts**: Concurrent edits handled with 409 responses  
✅ **Upload Recovery**: Cancel mid-upload, retry with same asset ID  
✅ **MIME Validation**: Server rejects files based on content analysis  
✅ **Path Safety**: Filenames sanitized to prevent traversal attacks  

## Trade-offs & Design Decisions

- **TTL = 90 seconds**: Balance between security and UX - long enough for most downloads, short enough to limit exposure
- **Client-side hashing**: Reduces server load but requires user to stay online during upload
- **Single storage bucket**: Simplifies permissions vs multiple buckets per user  
- **GraphQL over REST**: Better type safety and enables efficient batch operations
- **Optimistic locking**: Prevents data races while maintaining good performance

## Future Improvements

- **Thumbnail generation** for images via Edge Functions
- **Resumable uploads** for large files using tus protocol  
- **Redis caching** for frequently accessed metadata
- **Content-based deduplication** to save storage space
- **Advanced sharing** with time-limited access and download limits
- **Mobile app** with offline-first sync capabilities