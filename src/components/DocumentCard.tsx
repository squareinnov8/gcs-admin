'use client';

import { Document } from '@/types';
import { FileText, File, FileCode, Clock, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

interface DocumentCardProps {
  document: Document;
  onProcess: (id: string) => void;
  onView: (doc: Document) => void;
  isProcessing: boolean;
}

export function DocumentCard({ document, onProcess, onView, isProcessing }: DocumentCardProps) {
  const getFileIcon = () => {
    if (document.mimeType.includes('google-apps.document')) {
      return <FileText className="h-8 w-8 text-blue-500" />;
    }
    if (document.mimeType.includes('pdf')) {
      return <File className="h-8 w-8 text-red-500" />;
    }
    if (document.mimeType.includes('word')) {
      return <FileText className="h-8 w-8 text-blue-700" />;
    }
    if (document.name.endsWith('.md')) {
      return <FileCode className="h-8 w-8 text-gray-600" />;
    }
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const getStatusBadge = () => {
    // If document has WordPress info, show WordPress-specific status
    if (document.wpPostId) {
      if (document.wpStatus === 'publish') {
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Published
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Clock className="h-3 w-3 mr-1" />
            Draft in WP
          </span>
        );
      }
    }

    switch (document.status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
      case 'processed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ready
          </span>
        );
      case 'published':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Published
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">{getFileIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 truncate">{document.name}</h3>
            {getStatusBadge()}
          </div>
          {document.metadata && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">
              {document.metadata.description}
            </p>
          )}
          <div className="mt-2 flex items-center text-xs text-gray-400">
            <span>Modified: {new Date(document.modifiedTime).toLocaleDateString()}</span>
          </div>
          {document.metadata && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="inline-block px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs">
                {document.metadata.category}
              </span>
              {document.metadata.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* WordPress link if published */}
      {document.wpPostUrl && (
        <div className="mt-3 flex items-center text-xs">
          <a
            href={document.wpPostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View on WordPress
          </a>
        </div>
      )}

      <div className="mt-4 flex space-x-2">
        {document.status === 'pending' && (
          <button
            onClick={() => onProcess(document.id)}
            disabled={isProcessing}
            className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Process Document'
            )}
          </button>
        )}
        {(document.status === 'processed' || document.status === 'published') && (
          <button
            onClick={() => onView(document)}
            className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            {document.wpPostId ? 'View & Update' : 'View & Publish'}
          </button>
        )}
        {document.webViewLink && (
          <a
            href={document.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Open in Drive
          </a>
        )}
      </div>
    </div>
  );
}
