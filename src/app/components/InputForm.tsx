import React, { useState } from 'react';

type InputFormProps = {
  onSubmit: (query: string) => void;
  loading: boolean;
};

export default function InputForm({ onSubmit, loading }: InputFormProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !loading) {
      onSubmit(query.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about movies, actors, rentals, and more..."
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full sm:w-auto"
          >
            {loading ? 'Processing...' : 'Ask'}
          </button>
        </div>
      </form>
    </div>
  );
} 