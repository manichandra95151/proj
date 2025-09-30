import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, FileText } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
}

const ALLOWED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const DropZone: React.FC<DropZoneProps> = ({ onFilesSelected }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
        ${isDragActive && !isDragReject
          ? 'border-blue-500 bg-blue-50'
          : isDragReject
          ? 'border-red-500 bg-red-50'
          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }
      `}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center gap-4">
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center transition-colors
          ${isDragActive && !isDragReject
            ? 'bg-blue-100 text-blue-600'
            : isDragReject
            ? 'bg-red-100 text-red-600'
            : 'bg-gray-200 text-gray-600'
          }
        `}>
          <Upload className="w-8 h-8" />
        </div>

        <div>
          <h3 className={`text-lg font-semibold mb-2 ${
            isDragReject ? 'text-red-700' : 'text-gray-900'
          }`}>
            {isDragActive && !isDragReject
              ? 'Drop files here'
              : isDragReject
              ? 'Invalid file type'
              : 'Drop files here or click to browse'
            }
          </h3>
          
          <p className="text-sm text-gray-600 mb-4">
            Supports images (JPEG, PNG, GIF, WebP) and PDF files up to 50MB each
          </p>

          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <FileImage className="w-4 h-4" />
              <span>Images</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};