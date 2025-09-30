import React from 'react';
import { 
  Upload, 
  Check, 
  X, 
  RefreshCw, 
  AlertTriangle, 
  Loader, 
  File,
  Trash2
} from 'lucide-react';
import { UploadProgress, UploadState } from '../hooks/useUpload';

interface UploadCardProps {
  upload: UploadProgress;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}

const getStatusIcon = (state: UploadState) => {
  switch (state) {
    case 'idle':
    case 'requesting-ticket':
      return <Loader className="w-5 h-5 animate-spin" />;
    case 'uploading':
      return <Upload className="w-5 h-5" />;
    case 'verifying':
      return <Loader className="w-5 h-5 animate-spin" />;
    case 'ready':
      return <Check className="w-5 h-5" />;
    case 'corrupt':
    case 'error':
      return <AlertTriangle className="w-5 h-5" />;
    default:
      return <File className="w-5 h-5" />;
  }
};

const getStatusColor = (state: UploadState) => {
  switch (state) {
    case 'ready':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'corrupt':
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'uploading':
    case 'verifying':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const getStatusText = (state: UploadState, progress: number) => {
  switch (state) {
    case 'idle':
      return 'Preparing...';
    case 'requesting-ticket':
      return 'Getting authorization...';
    case 'uploading':
      return `Uploading ${progress}%`;
    case 'verifying':
      return 'Verifying integrity...';
    case 'ready':
      return 'Ready';
    case 'corrupt':
      return 'Integrity check failed';
    case 'error':
      return 'Upload failed';
    default:
      return 'Unknown';
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

export const UploadCard: React.FC<UploadCardProps> = ({
  upload,
  onCancel,
  onRetry,
  onRemove,
}) => {
  const { file, state, progress, error, canRetry } = upload;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center ${getStatusColor(state)}`}>
          {getStatusIcon(state)}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {file.name}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {formatFileSize(file.size)} • {file.type}
          </p>
          
          <div className="mt-2">
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(state)}`}>
              {getStatusIcon(state)}
              {getStatusText(state, progress)}
            </div>
          </div>

          {/* Progress bar for uploading state */}
          {state === 'uploading' && (
            <div className="mt-3">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {state === 'uploading' && (
            <button
              onClick={onCancel}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Cancel upload"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          {canRetry && (
            <button
              onClick={onRetry}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title="Retry upload"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          
          {(state === 'ready' || state === 'error' || state === 'corrupt') && (
            <button
              onClick={onRemove}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Remove from list"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};