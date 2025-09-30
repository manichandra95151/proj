import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { Download, Share2, CreditCard as Edit3, Trash2, Copy, Clock, Check, AlertTriangle } from 'lucide-react';

const GET_DOWNLOAD_URL = gql`
  query GetDownloadUrl($assetId: ID!) {
    getDownloadUrl(assetId: $assetId) {
      url
      expiresAt
    }
  }
`;

export interface Asset {
  id: string;
  filename: string;
  mime: string;
  size: number;
  status: string;
  version: number;
  createdAt: string;
  isOwner: boolean;
  canDownload: boolean;
}

interface AssetCardProps {
  asset: Asset;
  onRefresh: () => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ready':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'corrupt':
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    default:
      return null;
  }
};

const formatFileSize = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onRefresh }) => {
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [linkExpiry, setLinkExpiry] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  const [getDownloadUrl, { loading: downloadLoading }] = useMutation(GET_DOWNLOAD_URL, {
    onCompleted: (data) => {
      setDownloadLink(data.getDownloadUrl.url);
      setLinkExpiry(new Date(data.getDownloadUrl.expiresAt));
    },
  });

  const handleGetDownloadLink = async () => {
    try {
      await getDownloadUrl({
        variables: { assetId: asset.id },
      });
    } catch (error) {
      console.error('Failed to get download link:', error);
    }
  };

  const handleCopyLink = async () => {
    if (downloadLink) {
      await navigator.clipboard.writeText(downloadLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLinkExpired = linkExpiry && new Date() > linkExpiry;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* File type indicator */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
          {asset.mime.startsWith('image/') ? (
            <div className="text-2xl">🖼️</div>
          ) : asset.mime === 'application/pdf' ? (
            <div className="text-2xl">📄</div>
          ) : (
            <div className="text-2xl">📎</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {asset.filename}
            </h3>
            {getStatusIcon(asset.status)}
          </div>
          
          <p className="text-xs text-gray-500 mt-1">
            {formatFileSize(asset.size)} • {formatDate(asset.createdAt)}
          </p>

          {/* Download link section */}
          {downloadLink && !isLinkExpired && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-800">Download Link</span>
                <div className="flex items-center gap-1 text-xs text-blue-600">
                  <Clock className="w-3 h-3" />
                  Expires in {Math.round((linkExpiry!.getTime() - Date.now()) / 1000)}s
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={downloadLink}
                  readOnly
                  className="flex-1 text-xs bg-white border border-blue-200 rounded px-2 py-1"
                />
                <button
                  onClick={handleCopyLink}
                  className={`p-1 rounded transition-colors ${
                    copied
                      ? 'text-green-600 bg-green-100'
                      : 'text-blue-600 hover:bg-blue-100'
                  }`}
                  title={copied ? 'Copied!' : 'Copy link'}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {downloadLink && isLinkExpired && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-800">Download link has expired</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1">
          {asset.canDownload && asset.status === 'ready' && (
            <button
              onClick={handleGetDownloadLink}
              disabled={downloadLoading}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Get download link"
            >
              {downloadLoading ? (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          )}

          {asset.isOwner && (
            <>
              <button
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Share asset"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                title="Rename asset"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete asset"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};