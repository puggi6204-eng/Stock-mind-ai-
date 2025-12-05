
import React, { useState, useEffect } from 'react';
import { BrainCircuit, Play, History, Trash2, Clock, ChevronRight } from 'lucide-react';
import { getDeepAnalysis } from '../services/geminiService';

interface AnalysisHistory {
    id: string;
    query: string;
    result: string;
    timestamp: number;
}

interface DeepAnalysisProps {
    initialQuery?: string;
    initialResult?: string;
}

export const DeepAnalysis: React.FC<DeepAnalysisProps> = ({ initialQuery, initialResult }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<AnalysisHistory[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('deep_analysis_history');
          if (saved) return JSON.parse(saved);
      }
      return [];
  });

  // Load initial data if provided from Library
  useEffect(() => {
      if (initialQuery) setQuery(initialQuery);
      if (initialResult) setResult(initialResult);
  }, [initialQuery, initialResult]);

  useEffect(() => {
      localStorage.setItem('deep_analysis_history', JSON.stringify(history));
  }, [history]);

  const handleAnalyze = async () => {
    if (!query) return;
    setThinking(true);
    setResult('');
    try {
      const response = await getDeepAnalysis(query);
      const text = response || "Analysis failed.";
      setResult(text);
      
      // Save to history
      const newEntry: AnalysisHistory = {
          id: Date.now().toString(),
          query: query,
          result: text,
          timestamp: Date.now()
      };
      setHistory(prev => [newEntry, ...prev].slice(0, 10)); // Keep last 10
    } catch (e) {
        setResult("Error performing deep analysis.");
    } finally {
      setThinking(false);
    }
  };

  const loadHistory = (item: AnalysisHistory) => {
      setQuery(item.query);
      setResult(item.result);
  };

  const deleteHistory = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setHistory(prev => prev.filter(h => h.id !== id));
  };

  const clearAllHistory = () => {
      if(confirm('Clear all deep analysis history?')) {
          setHistory([]);
      }
  };

  return (
    <div className="flex h-full overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-indigo-400">
                <BrainCircuit /> Deep Market Analysis
            </h2>
            <p className="text-gray-400 mb-6">
                Powered by Gemini 2.5/3.0 Thinking Model. Best for complex "Why" and "What If" scenarios.
            </p>

            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6">
                <textarea 
                className="w-full bg-transparent text-white outline-none resize-none h-32"
                placeholder="E.g., Analyze the potential impact of crude oil price fluctuations on Indian paint sector stocks over the next 2 quarters..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                />
                <div className="flex justify-end mt-2">
                    <button 
                        onClick={handleAnalyze}
                        disabled={thinking}
                        className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {thinking ? "Thinking..." : <><Play size={16} /> Run Analysis</>}
                    </button>
                </div>
            </div>

            {result && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 animate-fade-in shadow-lg">
                    <h3 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2">
                        <BrainCircuit size={18}/> Analysis Report
                    </h3>
                    <div className="prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
                        {result}
                    </div>
                </div>
            )}
        </div>

        {/* Right Sidebar - History */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 p-4 flex flex-col hidden md:flex">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                    <History size={14} /> Previous Deep Dives
                </h3>
                {history.length > 0 && (
                    <button onClick={clearAllHistory} className="text-red-400 hover:text-red-300">
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                {history.length === 0 && <p className="text-gray-600 text-sm text-center mt-10">No history yet.</p>}
                {history.map(item => (
                    <div 
                        key={item.id}
                        onClick={() => loadHistory(item)}
                        className="bg-gray-800 border border-gray-700 p-3 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors group relative"
                    >
                        <p className="text-sm font-medium text-gray-200 line-clamp-2 mb-2 pr-4">
                            {item.query}
                        </p>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Clock size={10} /> {new Date(item.timestamp).toLocaleDateString()}</span>
                            <ChevronRight size={14} className="text-gray-600 group-hover:text-indigo-400" />
                        </div>
                        <button 
                            onClick={(e) => deleteHistory(e, item.id)}
                            className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};