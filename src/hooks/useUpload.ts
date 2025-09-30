import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import CryptoJS from 'crypto-js';

const CREATE_UPLOAD_URL = gql`
  mutation CreateUploadUrl($filename: String!, $mime: String!, $size: Int!) {
    createUploadUrl(filename: $filename, mime: $mime, size: $size) {
      assetId
      storagePath
      uploadUrl
      expiresAt
      nonce
    }
  }
`;

const FINALIZE_UPLOAD = gql`
  mutation FinalizeUpload($assetId: ID!, $clientSha256: String!, $version: Int!) {
    finalizeUpload(assetId: $assetId, clientSha256: $clientSha256, version: $version) {
      id
      filename
      status
      version
    }
  }
`;

export type UploadState = 
  | 'idle'
  | 'requesting-ticket'
  | 'uploading'
  | 'verifying'
  | 'ready'
  | 'corrupt'
  | 'error';

export interface UploadProgress {
  id: string;
  file: File;
  state: UploadState;
  progress: number;
  error?: string;
  canRetry: boolean;
  assetId?: string;
  version?: number;
}

export const useUpload = () => {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [createUploadUrl] = useMutation(CREATE_UPLOAD_URL);
  const [finalizeUpload] = useMutation(FINALIZE_UPLOAD);

  const computeSHA256 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wordArray = CryptoJS.lib.WordArray.create(e.target?.result as ArrayBuffer);
          const hash = CryptoJS.SHA256(wordArray).toString();
          resolve(hash);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const updateUpload = useCallback((id: string, update: Partial<UploadProgress>) => {
    setUploads(prev => prev.map(upload => 
      upload.id === id ? { ...upload, ...update } : upload
    ));
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    const uploadId = crypto.randomUUID();
    
    const newUpload: UploadProgress = {
      id: uploadId,
      file,
      state: 'idle',
      progress: 0,
      canRetry: false,
    };

    setUploads(prev => [...prev, newUpload]);

    try {
      // Step 1: Request upload ticket
      updateUpload(uploadId, { state: 'requesting-ticket' });

      const { data: ticketData } = await createUploadUrl({
        variables: {
          filename: file.name,
          mime: file.type,
          size: file.size,
        },
      });

      const ticket = ticketData.createUploadUrl;
      updateUpload(uploadId, { assetId: ticket.assetId });

      // Step 2: Compute client-side hash
      const clientSha256 = await computeSHA256(file);

      // Step 3: Upload file to signed URL
      updateUpload(uploadId, { state: 'uploading', progress: 0 });

      const abortController = new AbortController();
      
      // Store abort controller for cancellation
      updateUpload(uploadId, { 
        state: 'uploading', 
        abortController 
      } as any);

      const response = await fetch(ticket.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      // Step 4: Finalize upload
      updateUpload(uploadId, { state: 'verifying', progress: 100 });

      const { data: finalizeData } = await finalizeUpload({
        variables: {
          assetId: ticket.assetId,
          clientSha256,
          version: 1,
        },
      });

      const asset = finalizeData.finalizeUpload;
      
      updateUpload(uploadId, {
        state: asset.status as UploadState,
        version: asset.version,
        canRetry: asset.status === 'corrupt' || asset.status === 'error',
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      
      updateUpload(uploadId, {
        state: 'error',
        error: error.message,
        canRetry: true,
      });
    }
  }, [createUploadUrl, finalizeUpload, updateUpload]);

  const cancelUpload = useCallback((uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (upload && (upload as any).abortController) {
      (upload as any).abortController.abort();
      updateUpload(uploadId, { state: 'error', error: 'Cancelled by user' });
    }
  }, [uploads, updateUpload]);

  const retryUpload = useCallback((uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (upload && upload.canRetry) {
      uploadFile(upload.file);
      // Remove the old upload entry
      setUploads(prev => prev.filter(u => u.id !== uploadId));
    }
  }, [uploads, uploadFile]);

  const removeUpload = useCallback((uploadId: string) => {
    setUploads(prev => prev.filter(u => u.id !== uploadId));
  }, []);

  return {
    uploads,
    uploadFile,
    cancelUpload,
    retryUpload,
    removeUpload,
  };
};