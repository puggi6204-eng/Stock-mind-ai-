import React, { useState } from 'react';
import { Video, Film, AlertCircle } from 'lucide-react';
import { generateMarketVideo } from '../services/geminiService';

export const MarketVideo: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setError('');
    setVideoUrl('');

    try {
      const url = await generateMarketVideo(prompt);
      setVideoUrl(url);
    } catch (e: any) {
        if (e.message === "API_KEY_SELECTION_REQUIRED") {
            setError("Please select a paid API Key project via the popup.");
            if (window.aistudio) {
                try {
                    await window.aistudio.openSelectKey();
                } catch(err) { console.error(err)}
            }
        } else {
            setError("Failed to generate video. Ensure you are using a project with Veo access.");
        }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-pink-400">
        <Video /> Market Video Generator (Veo)
      </h2>
      
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8">
        <label className="block text-gray-400 mb-2">Describe the market scenario for the video:</label>
        <textarea 
            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-pink-500"
            rows={3}
            placeholder="A futuristic 3D animation of a bull market charging through a neon financial district..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
        />
        
        {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-200 rounded flex items-center gap-2">
                <AlertCircle size={16} /> {error}
                {error.includes("API Key") && <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline">Docs</a>}
            </div>
        )}

        <button 
            onClick={handleGenerate}
            disabled={loading}
            className="mt-4 bg-pink-600 hover:bg-pink-700 px-6 py-2 rounded-lg font-bold flex items-center gap-2 w-full justify-center"
        >
            {loading ? "Generating (this takes a minute)..." : <><Film size={18} /> Generate Video</>}
        </button>
      </div>

      {videoUrl && (
        <div className="bg-black rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
            <video controls src={videoUrl} className="w-full aspect-video" autoPlay loop />
            <div className="p-4 bg-gray-900">
                <p className="text-sm text-gray-400">Generated with Veo 3.1</p>
            </div>
        </div>
      )}
    </div>
  );
};