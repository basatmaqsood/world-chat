import React, { memo } from 'react';

type ResponseCardProps = {
  response: string;
  htmlResponse?: string;
  // sql, rawResults, error, responseTime, isCached, timing removed for optimization
};

const ERROR_STRING = 'Oops, something went wrong. Try again!';

const ResponseCard = memo(function ResponseCard({ response, htmlResponse }: ResponseCardProps) {
  const isError = response === ERROR_STRING;
  return (
    <div className="bg-gray-900 text-white rounded-lg shadow-md p-6 mt-8 max-w-4xl mx-auto animate-fade-in overflow-x-auto">
      <div className="text-lg font-medium mb-2">{isError ? 'Error' : 'Rental Chatbot'}</div>
      {isError ? (
        <div className="text-red-400">{response}</div>
      ) : (
        <div className="space-y-4">
          {/* Text response */}
          {response && response !== 'View formatted results below' && (
            <div className="text-white">{response}</div>
          )}
          {/* HTML response */}
          {htmlResponse && (
            <div 
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlResponse }}
            />
          )}
        </div>
      )}
    </div>
  );
});

export default ResponseCard; 