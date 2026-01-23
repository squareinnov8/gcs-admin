'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { DocumentCard } from '@/components/DocumentCard';
import { DocumentModal } from '@/components/DocumentModal';
import { Document } from '@/types';
import { RefreshCw, FolderOpen, AlertCircle, Zap } from 'lucide-react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [autoPublishing, setAutoPublishing] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchDocuments();
    }
  }, [session]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch documents');
      }

      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (documentId: string) => {
    setProcessingId(documentId);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process document');
      }

      setDocuments((docs) =>
        docs.map((d) => (d.id === documentId ? data.document : d))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process document');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAutoPublish = async () => {
    setAutoPublishing(true);
    try {
      const response = await fetch('/api/auto-publish');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Auto-publish failed');
      }

      if (data.processed === 0) {
        alert('No items ready to publish. Set status to "ready to post" in the Content Repo sheet.');
      } else {
        alert(`Auto-publish complete!\n\n${data.message}\n\nSuccessful: ${data.successful}\nFailed: ${data.failed}`);
        fetchDocuments(); // Refresh the list
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Auto-publish failed');
    } finally {
      setAutoPublishing(false);
    }
  };

  const handlePublish = async (
    doc: Document,
    publishStatus: 'draft' | 'publish',
    metadata: Document['metadata']
  ) => {
    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document: { ...doc, metadata },
        status: publishStatus,
        overrideMetadata: metadata,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to publish');
    }

    // Save WordPress info back to document store
    await fetch('/api/documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: doc.id,
        wpPostId: data.postId,
        wpPostUrl: data.postUrl,
        wpStatus: publishStatus,
      }),
    });

    // Update document in local state with WordPress info
    const updatedDoc: Document = {
      ...doc,
      metadata,
      status: 'published' as const,
      wpPostId: data.postId,
      wpPostUrl: data.postUrl,
      wpStatus: publishStatus,
      wpPublishedAt: new Date().toISOString(),
    };

    setDocuments((docs) =>
      docs.map((d) => (d.id === doc.id ? updatedDoc : d))
    );

    const action = data.isUpdate ? 'updated' : (publishStatus === 'draft' ? 'saved as draft' : 'published');
    alert(`Post ${action}! ${data.postUrl}`);
    setSelectedDocument(null);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <p className="text-sm text-gray-500 mt-1">
              Documents from Content Repo sheet ready for processing
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAutoPublish}
              disabled={autoPublishing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {autoPublishing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {autoPublishing ? 'Publishing...' : 'Auto-Publish Ready'}
            </button>
            <button
              onClick={fetchDocuments}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {documents.length === 0 && !error ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Add documents to your Google Drive folder to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onProcess={handleProcess}
                onView={setSelectedDocument}
                isProcessing={processingId === doc.id}
              />
            ))}
          </div>
        )}
      </main>

      {selectedDocument && (
        <DocumentModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onPublish={handlePublish}
        />
      )}
    </div>
  );
}
