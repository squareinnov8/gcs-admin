'use client';

import { useState, useEffect } from 'react';
import { Document, DocumentMetadata, WordPressCategory, WordPressUser, WordPressTag } from '@/types';
import { X, Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface DocumentModalProps {
  document: Document;
  onClose: () => void;
  onPublish: (doc: Document, status: 'draft' | 'publish', metadata: DocumentMetadata) => Promise<void>;
}

export function DocumentModal({ document, onClose, onPublish }: DocumentModalProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [metadata, setMetadata] = useState<DocumentMetadata>(document.metadata!);
  const [activeTab, setActiveTab] = useState<'preview' | 'metadata' | 'seo'>('metadata');
  const [wpData, setWpData] = useState<{
    categories: WordPressCategory[];
    users: WordPressUser[];
    tags: WordPressTag[];
  } | null>(null);
  const [loadingWpData, setLoadingWpData] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetchWordPressData();
  }, []);

  const fetchWordPressData = async () => {
    try {
      const response = await fetch('/api/wordpress/data');
      if (response.ok) {
        const data = await response.json();
        setWpData(data);
      }
    } catch (error) {
      console.error('Failed to fetch WordPress data:', error);
    } finally {
      setLoadingWpData(false);
    }
  };

  const handlePublish = async (status: 'draft' | 'publish') => {
    setIsPublishing(true);
    try {
      await onPublish(document, status, metadata);
    } finally {
      setIsPublishing(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
            <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">{metadata.title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 flex-shrink-0">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <nav className="flex -mb-px px-6">
              <button
                onClick={() => setActiveTab('metadata')}
                className={`py-3 px-4 text-sm font-medium border-b-2 ${
                  activeTab === 'metadata'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Article Details
              </button>
              <button
                onClick={() => setActiveTab('seo')}
                className={`py-3 px-4 text-sm font-medium border-b-2 ${
                  activeTab === 'seo'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                SEO Settings
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`py-3 px-4 text-sm font-medium border-b-2 ${
                  activeTab === 'preview'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Content Preview
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto flex-1">
            {activeTab === 'preview' && (
              <div className="prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: document.content || '' }} />
              </div>
            )}

            {activeTab === 'metadata' && (
              <div className="space-y-5">
                {/* Featured Image Preview */}
                {metadata.featuredImageData && metadata.featuredImageMimeType && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Featured Image</label>
                    <div className="flex items-start gap-4">
                      <img
                        src={`data:${metadata.featuredImageMimeType};base64,${metadata.featuredImageData}`}
                        alt="Featured"
                        className="w-48 h-32 object-cover rounded-lg border border-gray-200"
                      />
                      <div className="text-sm text-gray-600">
                        <p className="font-medium">{metadata.featuredImageName || 'Featured image'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          This image will be uploaded to WordPress when you publish.
                        </p>
                        {metadata.metadataSource === 'sheet' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-2">
                            From Content Repo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata Source Indicator */}
                {metadata.metadataSource && (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      metadata.metadataSource === 'sheet'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {metadata.metadataSource === 'sheet' ? '📊 From Content Repo' : '🤖 AI Generated'}
                    </span>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={metadata.title}
                    onChange={(e) => {
                      setMetadata({
                        ...metadata,
                        title: e.target.value,
                        slug: generateSlug(e.target.value)
                      });
                    }}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Slug
                    <span className="text-gray-400 font-normal ml-2">gotcommoncents.com/{metadata.slug || 'your-post-slug'}/</span>
                  </label>
                  <input
                    type="text"
                    value={metadata.slug}
                    onChange={(e) => setMetadata({ ...metadata, slug: e.target.value })}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                {/* Excerpt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
                  <textarea
                    value={metadata.excerpt}
                    onChange={(e) => setMetadata({ ...metadata, excerpt: e.target.value })}
                    rows={3}
                    placeholder="A short summary for previews and social sharing..."
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                {/* Category & Author Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    {loadingWpData ? (
                      <div className="flex items-center text-gray-400 text-sm py-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                      </div>
                    ) : (
                      <select
                        value={metadata.category}
                        onChange={(e) => setMetadata({ ...metadata, category: e.target.value })}
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      >
                        {wpData?.categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                        <option value="Personal Finance">Personal Finance</option>
                        <option value="Investing">Investing</option>
                        <option value="Budgeting">Budgeting</option>
                        <option value="Credit">Credit</option>
                        <option value="Retirement">Retirement</option>
                        <option value="Taxes">Taxes</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Real Estate">Real Estate</option>
                        <option value="Career">Career</option>
                        <option value="Lifestyle">Lifestyle</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                    {loadingWpData ? (
                      <div className="flex items-center text-gray-400 text-sm py-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                      </div>
                    ) : (
                      <select
                        value={metadata.authorId || wpData?.users[0]?.id || ''}
                        onChange={(e) => {
                          const userId = parseInt(e.target.value);
                          const user = wpData?.users.find(u => u.id === userId);
                          setMetadata({
                            ...metadata,
                            authorId: userId,
                            author: user?.name || metadata.author
                          });
                        }}
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      >
                        {wpData?.users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <input
                    type="text"
                    value={metadata.tags.join(', ')}
                    onChange={(e) =>
                      setMetadata({
                        ...metadata,
                        tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                      })
                    }
                    placeholder="budgeting, savings tips, financial planning"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Separate tags with commas</p>
                </div>

                {/* Publish Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Publish Date</label>
                    <input
                      type="date"
                      value={metadata.publishDate}
                      onChange={(e) => setMetadata({ ...metadata, publishDate: e.target.value })}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Post Format</label>
                    <select
                      value={metadata.format}
                      onChange={(e) => setMetadata({ ...metadata, format: e.target.value as any })}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="standard">Standard</option>
                      <option value="aside">Aside</option>
                      <option value="gallery">Gallery</option>
                      <option value="link">Link</option>
                      <option value="image">Image</option>
                      <option value="quote">Quote</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                    </select>
                  </div>
                </div>

                {/* Advanced Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                >
                  {showAdvanced ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                  Advanced Options
                </button>

                {showAdvanced && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description (internal notes)</label>
                      <textarea
                        value={metadata.description}
                        onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                        rows={2}
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'seo' && (
              <div className="space-y-5">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">SEO Preview</h4>
                  <div className="text-blue-900">
                    <div className="text-lg font-medium truncate">{metadata.seoTitle || metadata.title}</div>
                    <div className="text-sm text-green-700 truncate">gotcommoncents.com/{metadata.slug}/</div>
                    <div className="text-sm text-gray-600 line-clamp-2">{metadata.seoDescription || metadata.excerpt}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SEO Title
                    <span className={`ml-2 text-xs ${(metadata.seoTitle?.length || 0) > 60 ? 'text-red-500' : 'text-gray-400'}`}>
                      {metadata.seoTitle?.length || 0}/60 characters
                    </span>
                  </label>
                  <input
                    type="text"
                    value={metadata.seoTitle || ''}
                    onChange={(e) => setMetadata({ ...metadata, seoTitle: e.target.value })}
                    placeholder={metadata.title}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Optimal length: 50-60 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SEO Description
                    <span className={`ml-2 text-xs ${(metadata.seoDescription?.length || 0) > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                      {metadata.seoDescription?.length || 0}/160 characters
                    </span>
                  </label>
                  <textarea
                    value={metadata.seoDescription || ''}
                    onChange={(e) => setMetadata({ ...metadata, seoDescription: e.target.value })}
                    rows={3}
                    placeholder={metadata.excerpt}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Optimal length: 150-160 characters</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">SEO Tips</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Include your primary keyword in the SEO title</li>
                    <li>• Write a compelling description that encourages clicks</li>
                    <li>• Keep the URL slug short and descriptive</li>
                    <li>• Use the excerpt for social media previews</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t">
            <div className="text-sm text-gray-500">
              {document.wpPostId ? (
                <span className="text-purple-600">
                  Linked to WordPress (ID: {document.wpPostId})
                </span>
              ) : (
                <>Source: {document.name}</>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePublish('draft')}
                disabled={isPublishing}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {isPublishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {document.wpPostId ? 'Update Draft' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handlePublish('publish')}
                disabled={isPublishing}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {isPublishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {document.wpPostId ? 'Update & Publish' : 'Publish Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
