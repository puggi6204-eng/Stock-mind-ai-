
import React, { useState, useEffect } from 'react';
import { Monitor, Cpu, Clipboard, ScanLine, CheckCircle2, History, Trash2, Clock, Upload, Image as ImageIcon, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { analyzeFinancialScreenshot } from '../services/geminiService';

interface ScreenHistory {
    id: string;
    analysis: string; // JSON string
    timestamp: number;
}

export const AdvanceScreen: React.FC = () => {
    const [pastedImage, setPastedImage] = useState<File | null>(null);
    const [preview, setPreview] = useState('');
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<ScreenHistory[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('screen_analysis_history');
            if (saved) return JSON.parse(saved);
        }
        return [];
    });
  
    useEffect(() => {
        localStorage.setItem('screen_analysis_history', JSON.stringify(history));
    }, [history]);

    // Handle paste event (Desktop)
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    setPastedImage(file);
                    setPreview(URL.createObjectURL(file));
                    setAnalysis(''); 
                }
            }
        }
    };

    // Handle Upload (Mobile)
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPastedImage(file);
            setPreview(URL.createObjectURL(file));
            setAnalysis('');
        }
    };

    const analyzeScreen = async () => {
        if (!pastedImage) return;
        setLoading(true);
        const res = await analyzeFinancialScreenshot(pastedImage);
        setAnalysis(res);
        setLoading(false);

        // Save History
        const newEntry: ScreenHistory = {
            id: Date.now().toString(),
            analysis: res,
            timestamp: Date.now()
        };
        setHistory(prev => [newEntry, ...prev].slice(0, 10));
    };

    const deleteHistory = (id: string) => {
        setHistory(prev => prev.filter(h => h.id !== id));
    };

    const renderAnalysisContent = (jsonString: string) => {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.error) {
                return (
                    <div className="flex flex-col items-center justify-center p-6 text-red-400">
                        <AlertTriangle size={32} className="mb-2" />
                        <p>{data.error}</p>
                    </div>
                );
            }

            return (
                <div className="space-y-6">
                    {/* Header Summary */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-700 pb-4 gap-4">
                        <div>
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                {data.symbol || "Unknown Asset"}
                                {data.trend === 'Bullish' && <span className="text-sm bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1"><TrendingUp size={14}/> Bullish</span>}
                                {data.trend === 'Bearish' && <span className="text-sm bg-red-500/20 text-red-400 px-2 py-1 rounded-full flex items-center gap-1"><TrendingDown size={14}/> Bearish</span>}
                                {data.trend === 'Sideways' && <span className="text-sm bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full flex items-center gap-1"><Minus size={14}/> Sideways</span>}
                            </h3>
                            <p className="text-gray-400 text-sm mt-1">{data.summary}</p>
                        </div>
                        
                        {/* Trade Action Card */}
                        {data.trade_setup && (
                            <div className={`px-6 py-4 rounded-xl border-l-4 shadow-lg min-w-[200px] w-full md:w-auto ${
                                data.trade_setup.action === 'BUY' ? 'bg-green-900/20 border-green-500' :
                                data.trade_setup.action === 'SELL' ? 'bg-red-900/20 border-red-500' : 'bg-gray-700/30 border-gray-500'
                            }`}>
                                <p className="text-xs uppercase font-bold text-gray-400 mb-1">Action</p>
                                <p className={`text-2xl font-black ${
                                    data.trade_setup.action === 'BUY' ? 'text-green-400' :
                                    data.trade_setup.action === 'SELL' ? 'text-red-400' : 'text-gray-300'
                                }`}>
                                    {data.trade_setup.action}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Trade Levels */}
                    {data.trade_setup && (
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-700 text-center">
                                <p className="text-xs text-gray-400 uppercase font-bold">Entry</p>
                                <p className="text-blue-300 font-bold">{data.trade_setup.entry}</p>
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-700 text-center">
                                <p className="text-xs text-gray-400 uppercase font-bold">Stop Loss</p>
                                <p className="text-red-400 font-bold">{data.trade_setup.stop_loss}</p>
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-700 text-center">
                                <p className="text-xs text-gray-400 uppercase font-bold">Target</p>
                                <p className="text-green-400 font-bold">{data.trade_setup.target}</p>
                            </div>
                        </div>
                    )}

                    {/* Technical Table */}
                    {data.technical_table && (
                        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                            <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 font-bold text-xs text-gray-400 uppercase tracking-wider">
                                Technical Indicators
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-800/50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Parameter</th>
                                        <th className="px-4 py-3 font-medium">Value / Observation</th>
                                        <th className="px-4 py-3 font-medium text-right">Signal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {data.technical_table.map((row: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-cyan-400">{row.parameter}</td>
                                            <td className="px-4 py-3 text-gray-300">{row.value}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    row.signal.includes('Buy') || row.signal.includes('Bullish') || row.signal.includes('Support') ? 'bg-green-900/30 text-green-400' :
                                                    row.signal.includes('Sell') || row.signal.includes('Bearish') || row.signal.includes('Resistance') ? 'bg-red-900/30 text-red-400' :
                                                    'bg-gray-700 text-gray-400'
                                                }`}>
                                                    {row.signal}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            );
        } catch (e) {
            // Fallback for plain text
            return (
                <div className="prose prose-invert prose-cyan max-w-none whitespace-pre-wrap leading-relaxed">
                    {jsonString}
                </div>
            );
        }
    };

    return (
        <div className="p-4 md:p-6 h-full flex flex-col" onPaste={handlePaste}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-cyan-400">
                <Monitor /> Advance AI Screen Analysis
            </h2>
            <div className="bg-gray-800/50 p-4 rounded-lg border border-cyan-900 mb-6">
                <p className="text-cyan-200 text-sm flex items-center gap-2">
                    <Cpu size={16} /> 
                    <span>
                        <span className="hidden md:inline">Paste a screenshot (Ctrl+V) or </span>
                        upload an image. AI will generate a structured technical table.
                    </span>
                </p>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
                {/* Left: Input Area */}
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                    <div className="border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center bg-gray-900/50 relative overflow-hidden group min-h-[250px] transition-colors hover:border-cyan-500/50">
                        {preview ? (
                            <>
                                <img src={preview} alt="Screen" className="max-w-full max-h-[400px] object-contain" />
                                {loading && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col z-10">
                                        <ScanLine size={48} className="text-cyan-400 animate-pulse mb-4" />
                                        <p className="text-cyan-400 font-mono animate-pulse">SCANNING PATTERNS...</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center text-gray-500 p-6">
                                <Clipboard size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="mb-4 text-lg">Paste Screenshot (Ctrl+V)</p>
                                <p className="text-sm opacity-50 mb-4">- OR -</p>
                                <label className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg cursor-pointer flex items-center gap-2 transition-colors shadow-lg">
                                    <Upload size={18} />
                                    Upload Image
                                    <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                                </label>
                            </div>
                        )}
                        
                        {preview && !loading && !analysis && (
                            <div className="absolute bottom-4 flex gap-4 z-20">
                                <label className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full cursor-pointer shadow-lg border border-gray-600" title="Change Image">
                                    <ImageIcon size={20} />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                                </label>
                                <button 
                                    onClick={analyzeScreen}
                                    className="bg-cyan-600 hover:bg-cyan-700 px-8 py-2 rounded-full shadow-lg font-bold transition-all transform hover:scale-105 flex items-center gap-2"
                                >
                                    <Cpu size={18} /> Analyze Screen
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Output */}
                    {analysis && (
                        <div className="bg-gray-800 rounded-xl p-4 md:p-6 border border-gray-700 shadow-xl animate-fade-in">
                             <h3 className="text-lg font-bold text-cyan-400 mb-6 border-b border-gray-700 pb-2 flex items-center gap-2">
                                <CheckCircle2 size={18} className="text-green-500" /> Technical Analysis
                            </h3>
                             {renderAnalysisContent(analysis)}
                        </div>
                    )}
                </div>

                {/* Right: History Sidebar (Desktop & Mobile) */}
                <div className="w-full lg:w-80 bg-gray-800/30 border border-gray-700 rounded-xl p-4 flex flex-col max-h-[400px] lg:max-h-none">
                     <h3 className="text-gray-400 font-bold uppercase text-xs tracking-wider flex items-center gap-2 mb-4">
                        <History size={14} /> Previous Screens
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                        {history.length === 0 && <p className="text-gray-500 text-sm text-center mt-10">No screen analysis history.</p>}
                        {history.map(item => {
                            let summary = "";
                            try {
                                const parsed = JSON.parse(item.analysis);
                                summary = parsed.summary || parsed.symbol || "Analysis Report";
                            } catch {
                                summary = "Text Analysis";
                            }

                            return (
                                <div key={item.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-cyan-500/50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                         <span className="text-xs font-bold text-cyan-400 line-clamp-1">{summary}</span>
                                         <button onClick={() => deleteHistory(item.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={12}/></button>
                                    </div>
                                    <button 
                                        onClick={() => setAnalysis(item.analysis)} 
                                        className="text-xs text-gray-400 hover:text-white underline mb-1"
                                    >
                                        View Table
                                    </button>
                                    <p className="text-[10px] text-gray-600 flex items-center gap-1">
                                        <Clock size={10} /> {new Date(item.timestamp).toLocaleDateString()}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
