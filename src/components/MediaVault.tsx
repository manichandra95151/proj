import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { useAuth } from '../hooks/useAuth';
import { useUpload } from '../hooks/useUpload';
import { DropZone } from './DropZone';
import { UploadCard } from './UploadCard';
import { AssetCard, Asset } from './AssetCard';
import { LogOut, Search, Settings } from 'lucide-react';

const GET_MY_ASSETS = gql`
  query GetMyAssets($first: Int, $after: String, $q: String) {
    myAssets(first: $first, after: $after, q: $q) {
      edges {
        node {
          id
          filename
          mime
          size
          status
          version
          createdAt
          isOwner
          canDownload
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const MediaVault: React.FC = () => {
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [devMode, setDevMode] = useState(false);

  const { uploads, uploadFile, cancelUpload, retryUpload, removeUpload } = useUpload();

  const { data, loading, refetch } = useQuery(GET_MY_ASSETS, {
    variables: { first: 50, q: searchQuery },
    pollInterval: 5000, // Poll every 5 seconds for updates
  });

  const handleFilesSelected = (files: File[]) => {
    files.forEach(file => uploadFile(file));
  };

  const assets: Asset[] = data?.myAssets.edges.map((edge: any) => edge.node) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Secure Media Vault</h1>
            <span className="text-sm text-gray-500">Welcome, {user?.email}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Dev Tools Toggle */}
            <button
              onClick={() => setDevMode(!devMode)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                devMode
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Dev Tools {devMode ? 'ON' : 'OFF'}
            </button>

            {/* Settings */}
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>

            {/* Sign Out */}
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Upload Section */}
        <div className="mb-8">
          <DropZone onFilesSelected={handleFilesSelected} />
        </div>

        {/* Upload Progress */}
        {uploads.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Uploads</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uploads.map((upload) => (
                <UploadCard
                  key={upload.id}
                  upload={upload}
                  onCancel={() => cancelUpload(upload.id)}
                  onRetry={() => retryUpload(upload.id)}
                  onRemove={() => removeUpload(upload.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Assets Gallery */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Files</h2>
            <button
              onClick={() => refetch()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Refresh
            </button>
          </div>

          {loading && assets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading your files...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No files uploaded yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Drag and drop files above to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onRefresh={() => refetch()}
                />
              ))}
            </div>
          )}
        </div>

        {/* Dev Tools Panel */}
        {devMode && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-4">Development Tools</h3>
            <p className="text-sm text-yellow-700">
              This panel simulates network issues for testing upload resilience.
              Features like flaky network simulation would be implemented here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};