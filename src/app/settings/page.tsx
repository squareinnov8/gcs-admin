'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wordpressStatus, setWordpressStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [wordpressError, setWordpressError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      testWordPressConnection();
    }
  }, [session]);

  const testWordPressConnection = async () => {
    setWordpressStatus('loading');
    try {
      const response = await fetch('/api/wordpress/test');
      const data = await response.json();

      if (data.success) {
        setWordpressStatus('connected');
        setWordpressError(null);
      } else {
        setWordpressStatus('error');
        setWordpressError(data.error);
      }
    } catch (err) {
      setWordpressStatus('error');
      setWordpressError('Failed to connect to WordPress');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        </main>
      </div>
    );
  }

  const hasGoogleToken = !!(session as any)?.accessToken;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        <div className="space-y-6">
          {/* Google Drive Connection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Google Drive</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Connect to Google Drive to sync documents
                </p>
              </div>
              <div className="flex items-center">
                {hasGoogleToken ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    <XCircle className="h-4 w-4 mr-1" />
                    Not connected
                  </span>
                )}
              </div>
            </div>
            {!hasGoogleToken && (
              <div className="mt-4 text-sm text-gray-600">
                Sign in with Google to connect your Drive account. Make sure you sign out and sign in
                again with Google if you originally used email/password.
              </div>
            )}
          </div>

          {/* WordPress Connection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">WordPress</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Publish articles to your WordPress site
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {wordpressStatus === 'loading' && (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                )}
                {wordpressStatus === 'connected' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Connected
                  </span>
                )}
                {wordpressStatus === 'error' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <XCircle className="h-4 w-4 mr-1" />
                    Error
                  </span>
                )}
                <button
                  onClick={testWordPressConnection}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Test connection
                </button>
              </div>
            </div>
            {wordpressError && (
              <div className="mt-4 p-3 bg-red-50 rounded-md text-sm text-red-700">
                {wordpressError}
              </div>
            )}
          </div>

          {/* Configuration Guide */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Setup Guide</h2>
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <h3 className="font-medium text-gray-900">1. Google Drive Setup</h3>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Create a project in Google Cloud Console</li>
                  <li>Enable the Google Drive API</li>
                  <li>Create OAuth 2.0 credentials</li>
                  <li>Add your client ID and secret to .env</li>
                  <li>Create a folder in Google Drive for your documents</li>
                  <li>Copy the folder ID to GOOGLE_DRIVE_FOLDER_ID</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">2. WordPress Setup</h3>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Go to WordPress Admin → Users → Profile</li>
                  <li>Scroll to "Application Passwords"</li>
                  <li>Create a new application password</li>
                  <li>Add the credentials to your .env file</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">3. Claude API Setup</h3>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Get an API key from console.anthropic.com</li>
                  <li>Add it to ANTHROPIC_API_KEY in .env</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
