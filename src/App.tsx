import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { useAuth } from './hooks/useAuth';
import { apolloClient } from './lib/apollo';
import { Auth } from './components/Auth';
import { MediaVault } from './components/MediaVault';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ApolloProvider client={apolloClient}>
      {user ? <MediaVault /> : <Auth />}
    </ApolloProvider>
  );
}

export default App;