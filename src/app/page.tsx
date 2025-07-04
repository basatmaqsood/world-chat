"use client";

import dynamic from "next/dynamic";
import React, { useState, useCallback } from "react";
import InputForm from "./components/InputForm";
import LoadingSpinner from "./components/LoadingSpinner";
import { processUserQuery, QueryResult } from "./actions";

const ResponseCard = dynamic(() => import("./components/ResponseCard"), { ssr: false });

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>("");

  const handleSubmit = useCallback(async (query: string) => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    setLoadingStep("Analyzing your query...");
    try {
      const updateSteps = [
        { step: "Loading database schema...", delay: 200 },
        { step: "Generating SQL query...", delay: 500 },
        { step: "Executing database query...", delay: 800 },
        { step: "Formatting results...", delay: 1200 },
      ];
      let currentStep = 0;
      const stepInterval = setInterval(() => {
        if (currentStep < updateSteps.length) {
          setLoadingStep(updateSteps[currentStep].step);
          currentStep++;
        } else {
          clearInterval(stepInterval);
        }
      }, 300);
      const res = await processUserQuery(query);
      clearInterval(stepInterval);
      setResult(res);
    } catch (e: unknown) {
      setResult({
        response: "Oops, something went wrong. Try again!",
        htmlResponse: undefined,
      });
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  }, [loading]);

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start py-12 px-4">
      <h1 className="text-4xl font-extrabold mb-2 text-center text-blue-400 drop-shadow">World Chat</h1>
      <p className="text-lg text-gray-300 mb-8 text-center max-w-2xl">
        Ask about countries, cities, populations, and more from the sample World database. Try: <span className="italic text-blue-300">&quot;List all countries in Europe with a population over 10 million.&quot;</span>
      </p>
      <InputForm onSubmit={handleSubmit} loading={loading} />
      {loading && (
        <div className="mt-8 text-center">
          <LoadingSpinner />
          <p className="text-blue-400 mt-4 animate-pulse">{loadingStep}</p>
        </div>
      )}
      {result && (
        <ResponseCard
          response={result.response}
          htmlResponse={result.htmlResponse}
        />
      )}
      <footer className="mt-16 text-gray-500 text-xs text-center">
        &copy; {new Date().getFullYear()} World Chat &mdash; Powered by Next.js, Tailwind CSS, and Gemini AI
      </footer>
    </main>
  );
}
