
import React, { useState, useEffect } from 'react';
import { Image, Upload, Eye, History, Clock, Trash2, ChevronDown } from 'lucide-react';
import { analyzeUploadedFile } from '../services/geminiService';

interface MMHistory {
    id: string;
    prompt: string;
    result: string;
    timestamp: number;
}

export const MultimodalInput: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<MMHistory[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('multimodal_history');
          if (saved) return JSON.parse(saved);
      }
      return [];
  });

  useEffect(() => {
      localStorage.setItem('multimodal_history', JSON.stringify(history));
  }, [history]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setAnalysis('');
    
    const userPrompt = prompt || "Analyze this financial image/video in detail.";
    const result = await analyzeUploadedFile(file, userPrompt);
    setAnalysis(result);
    setLoading(false);

    // Save text result only (images are too big for localStorage)
    const newEntry: MMHistory = {
        id: Date.now().toString(),
        prompt: userPrompt,
        result: result,
        timestamp: Date.now()
    };
    setHistory(prev => [newEntry, ...prev].slice(0, 10));
  };

  const deleteHistory = (id: string) => {
      setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-yellow-400">
        <Eye /> Photo & Video Analysis
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Interface */}
        <div className="lg:col-span-2 space-y-6">
            <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-yellow-500 transition-colors">
                <input type="file" id="mm-upload" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
                <label htmlFor="mm-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload size={48} className="text-gray-400" />
                    <span className="text-lg font-medium text-gray-300">Upload Chart or Video</span>
                    <span className="text-sm text-gray-500">Supports PNG, JPG, MP4</span>
                </label>
            </div>

            {preview && (
                <div className="rounded-xl overflow-hidden border border-gray-700 bg-black">
                    {file?.type.startsWith('video') ? (
                        <video src={preview} controls className="w-full max-h-[300px] object-contain" />
                    ) : (
                        <img src={preview} alt="Preview" className="w-full max-h-[300px] object-contain" />
                    )}
                </div>
            )}
            
            <div className="flex flex-col gap-4">
                <textarea 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-white resize-none h-24 focus:outline-none focus:border-yellow-500"
                    placeholder="Ask something about this image (e.g., 'What is the trend pattern here?')"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
                
                <button 
                    onClick={handleAnalyze}
                    disabled={loading || !file}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-colors"
                >
                    {loading ? "Analyzing..." : "Analyze Media"}
                </button>

                {analysis && (
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <h3 className="text-yellow-400 font-bold mb-2">AI Insights:</h3>
                        <p className="whitespace-pre-wrap text-gray-300">{analysis}</p>
                    </div>
                )}
            </div>
        </div>

        {/* History Sidebar */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 h-full overflow-hidden flex flex-col">
            <h3 className="text-gray-400 font-bold uppercase text-xs tracking-wider flex items-center gap-2 mb-4">
                <History size={14} /> Recent Analysis
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                {history.length === 0 && <p className="text-gray-500 text-sm text-center">No recent history.</p>}
                {history.map(item => (
                    <div key={item.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3 group">
                        <div className="flex justify-between items-start mb-2">
                             <p className="text-xs font-bold text-gray-400 line-clamp-1">{item.prompt}</p>
                             <button onClick={() => deleteHistory(item.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={12}/></button>
                        </div>
                        <div className="text-sm text-gray-300 line-clamp-4 mb-2">
                            {item.result}
                        </div>
                        <p className="text-[10px] text-gray-600 flex items-center gap-1">
                            <Clock size={10} /> {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
