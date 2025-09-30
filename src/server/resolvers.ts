import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { GraphQLError } from 'graphql';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper to get user from token
const getUserFromToken = async (token: string) => {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new GraphQLError('Unauthorized', {
      extensions: { code: 'UNAUTHENTICATED' }
    });
  }
  return user;
};

// Helper to sanitize filename
const sanitizeFilename = (filename: string): string => {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars
    .replace(/\.{2,}/g, '.') // Replace multiple dots
    .substring(0, 255); // Limit length
};

// Helper to generate storage path
const generateStoragePath = (userId: string, filename: string): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const assetId = uuidv4();
  const safeFilename = sanitizeFilename(filename);
  
  return `${userId}/${year}/${month}/${assetId}-${safeFilename}`;
};

export const resolvers = {
  Query: {
    myAssets: async (_: any, { first = 50, after, q }: any, { token }: any) => {
      const user = await getUserFromToken(token);
      
      let query = supabase
        .from('asset')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (q) {
        query = query.ilike('filename', `%${q}%`);
      }

      if (after) {
        query = query.gt('created_at', after);
      }

      query = query.limit(first);

      const { data: assets, error } = await query;

      if (error) {
        throw new GraphQLError('Failed to fetch assets', {
          extensions: { code: 'INTERNAL_ERROR' }
        });
      }

      const edges = assets.map(asset => ({
        cursor: asset.created_at,
        node: {
          ...asset,
          isOwner: true,
          canDownload: asset.status === 'ready'
        }
      }));

      return {
        edges,
        pageInfo: {
          endCursor: edges[edges.length - 1]?.cursor,
          hasNextPage: edges.length === first
        }
      };
    },

    getDownloadUrl: async (_: any, { assetId }: any, { token }: any) => {
      const user = await getUserFromToken(token);
      
      // Check if user can access this asset
      const { data: asset, error } = await supabase
        .from('asset')
        .select(`
          *,
          asset_share!inner(*)
        `)
        .eq('id', assetId)
        .or(`owner_id.eq.${user.id},asset_share.to_user.eq.${user.id}`)
        .eq('status', 'ready')
        .single();

      if (error || !asset) {
        throw new GraphQLError('Asset not found or access denied', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Generate signed URL with 90 second expiry
      const { data: { signedUrl }, error: signError } = await supabase
        .storage
        .from('private')
        .createSignedUrl(asset.storage_path, 90);

      if (signError || !signedUrl) {
        throw new GraphQLError('Failed to generate download link', {
          extensions: { code: 'INTERNAL_ERROR' }
        });
      }

      // Log download attempt
      await supabase
        .from('download_audit')
        .insert({
          asset_id: assetId,
          user_id: user.id
        });

      const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();

      return {
        url: signedUrl,
        expiresAt
      };
    }
  },

  Mutation: {
    createUploadUrl: async (_: any, { filename, mime, size }: any, { token }: any) => {
      const user = await getUserFromToken(token);

      // Validate file type
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      if (!allowedMimes.includes(mime)) {
        throw new GraphQLError('File type not allowed', {
          extensions: { code: 'BAD_REQUEST' }
        });
      }

      // Validate file size (50MB max)
      if (size > 50 * 1024 * 1024) {
        throw new GraphQLError('File too large', {
          extensions: { code: 'BAD_REQUEST' }
        });
      }

      const assetId = uuidv4();
      const storagePath = generateStoragePath(user.id, filename);
      const nonce = crypto.randomBytes(32).toString('hex');

      // Create asset record
      const { error: assetError } = await supabase
        .from('asset')
        .insert({
          id: assetId,
          owner_id: user.id,
          filename: sanitizeFilename(filename),
          mime,
          size,
          storage_path: storagePath,
          status: 'draft'
        });

      if (assetError) {
        throw new GraphQLError('Failed to create asset', {
          extensions: { code: 'INTERNAL_ERROR' }
        });
      }

      // Create upload ticket
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      const { error: ticketError } = await supabase
        .from('upload_ticket')
        .insert({
          asset_id: assetId,
          user_id: user.id,
          nonce,
          mime,
          size,
          storage_path: storagePath,
          expires_at: expiresAt.toISOString()
        });

      if (ticketError) {
        throw new GraphQLError('Failed to create upload ticket', {
          extensions: { code: 'INTERNAL_ERROR' }
        });
      }

      // Generate signed upload URL
      const { data: { signedUrl }, error: signError } = await supabase
        .storage
        .from('private')
        .createSignedUploadUrl(storagePath);

      if (signError || !signedUrl) {
        throw new GraphQLError('Failed to generate upload URL', {
          extensions: { code: 'INTERNAL_ERROR' }
        });
      }

      return {
        assetId,
        storagePath,
        uploadUrl: signedUrl,
        expiresAt: expiresAt.toISOString(),
        nonce
      };
    },

    finalizeUpload: async (_: any, { assetId, clientSha256, version }: any, { token }: any) => {
      const user = await getUserFromToken(token);

      // Get and validate ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('upload_ticket')
        .select('*')
        .eq('asset_id', assetId)
        .eq('user_id', user.id)
        .single();

      if (ticketError || !ticket || ticket.used) {
        throw new GraphQLError('Invalid or used upload ticket', {
          extensions: { code: 'BAD_REQUEST' }
        });
      }

      // Check if ticket expired
      if (new Date() > new Date(ticket.expires_at)) {
        throw new GraphQLError('Upload ticket expired', {
          extensions: { code: 'BAD_REQUEST' }
        });
      }

      // Mark ticket as used
      await supabase
        .from('upload_ticket')
        .update({ used: true })
        .eq('asset_id', assetId);

      // Call hash function to verify file
      const hashResponse = await fetch(`${supabaseUrl}/functions/v1/hash-object`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: ticket.storage_path }),
      });

      if (!hashResponse.ok) {
        // Mark asset as corrupt
        await supabase
          .from('asset')
          .update({ 
            status: 'corrupt',
            version: version + 1 
          })
          .eq('id', assetId);

        throw new GraphQLError('File verification failed', {
          extensions: { code: 'INTEGRITY_ERROR' }
        });
      }

      const { sha256: serverSha256 } = await hashResponse.json();

      // Compare hashes
      if (clientSha256 !== serverSha256) {
        await supabase
          .from('asset')
          .update({ 
            status: 'corrupt',
            version: version + 1 
          })
          .eq('id', assetId);

        throw new GraphQLError('Hash mismatch - file integrity check failed', {
          extensions: { code: 'INTEGRITY_ERROR' }
        });
      }

      // Update asset to ready status
      const { data: asset, error: updateError } = await supabase
        .from('asset')
        .update({
          status: 'ready',
          sha256: serverSha256,
          version: version + 1
        })
        .eq('id', assetId)
        .eq('version', version)
        .select()
        .single();

      if (updateError) {
        throw new GraphQLError('Version conflict - asset was modified', {
          extensions: { code: 'VERSION_CONFLICT' }
        });
      }

      return {
        ...asset,
        isOwner: true,
        canDownload: true
      };
    },

    renameAsset: async (_: any, { assetId, filename, version }: any, { token }: any) => {
      const user = await getUserFromToken(token);

      const { data: asset, error } = await supabase
        .from('asset')
        .update({
          filename: sanitizeFilename(filename),
          version: version + 1
        })
        .eq('id', assetId)
        .eq('owner_id', user.id)
        .eq('version', version)
        .select()
        .single();

      if (error) {
        throw new GraphQLError('Version conflict or asset not found', {
          extensions: { code: 'VERSION_CONFLICT' }
        });
      }

      return {
        ...asset,
        isOwner: true,
        canDownload: asset.status === 'ready'
      };
    },

    deleteAsset: async (_: any, { assetId, version }: any, { token }: any) => {
      const user = await getUserFromToken(token);

      // Get asset info first
      const { data: asset } = await supabase
        .from('asset')
        .select('storage_path')
        .eq('id', assetId)
        .eq('owner_id', user.id)
        .single();

      if (!asset) {
        throw new GraphQLError('Asset not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Delete from storage
      await supabase.storage
        .from('private')
        .remove([asset.storage_path]);

      // Delete from database
      const { error } = await supabase
        .from('asset')
        .delete()
        .eq('id', assetId)
        .eq('owner_id', user.id)
        .eq('version', version);

      if (error) {
        throw new GraphQLError('Version conflict', {
          extensions: { code: 'VERSION_CONFLICT' }
        });
      }

      return true;
    }
  }
};