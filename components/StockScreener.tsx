import React, { useState, useEffect } from 'react';
import { Filter, Search, Loader2, DollarSign, PieChart, Activity, AlertCircle, Save, FolderOpen, Trash2, X, Check } from 'lucide-react';
import { runStockScreener } from '../services/geminiService';

interface ScreenerFilters {
    sector: string;
    marketCap: string;
    peRatio: string;
    volume: string;
}

interface Preset {
    id: string;
    name: string;
    filters: ScreenerFilters;
}

export const StockScreener: React.FC = () => {
    // Initialize filters from localStorage to persist user selection across sessions
    const [filters, setFilters] = useState<ScreenerFilters>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('stock_screener_filters');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error("Failed to parse saved filters:", e);
                }
            }
        }
        return {
            sector: 'All',
            marketCap: 'Any',
            peRatio: 'Any',
            volume: 'Any'
        };
    });
    
    // Preset State
    const [presets, setPresets] = useState<Preset[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('stock_screener_presets');
            if (saved) return JSON.parse(saved);
        }
        return [];
    });
    const [isNaming, setIsNaming] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);
    
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Persist filters to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('stock_screener_filters', JSON.stringify(filters));
    }, [filters]);

    const handleSavePreset = () => {
        if (!presetName.trim()) return;
        
        const newPreset: Preset = {
            id: Date.now().toString(),
            name: presetName.trim(),
            filters: { ...filters }
        };
        
        const updatedPresets = [...presets, newPreset];
        setPresets(updatedPresets);
        localStorage.setItem('stock_screener_presets', JSON.stringify(updatedPresets));
        
        setPresetName('');
        setIsNaming(false);
    };

    const handleLoadPreset = (preset: Preset) => {
        setFilters(preset.filters);
        setShowPresetsDropdown(false);
    };

    const handleDeletePreset = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const updatedPresets = presets.filter(p => p.id !== id);
        setPresets(updatedPresets);
        localStorage.setItem('stock_screener_presets', JSON.stringify(updatedPresets));
    };

    const sectors = ["All", "Technology", "Finance", "Healthcare", "Energy", "Automobile", "FMCG", "Metals"];
    const marketCaps = ["Any", "Large Cap (>20k Cr)", "Mid Cap (5k-20k Cr)", "Small Cap (<5k Cr)"];
    const peRatios = ["Any", "Undervalued (<15)", "Fair (15-30)", "Overvalued (>30)"];
    const volumes = ["Any", "High Volume", "Moderate", "Low Volume"];

    const handleRunScreener = async () => {
        setLoading(true);
        setError('');
        setResults([]);
        
        try {
            const data = await runStockScreener(filters);
            if (Array.isArray(data) && data.length > 0) {
                setResults(data);
            } else {
                setError("No matching stocks found. Try broadening your criteria.");
            }
        } catch (e) {
            setError("Failed to fetch screener data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-purple-400">
                <Filter /> AI Stock Screener
            </h2>
            
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8 shadow-lg relative z-10">
                {/* Preset Toolbar */}
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                    <h3 className="text-gray-300 font-bold flex items-center gap-2">
                        <Activity size={16} /> Criteria
                    </h3>
                    <div className="flex items-center gap-2 relative">
                        {isNaming ? (
                            <div className="flex items-center gap-2 animate-fade-in">
                                <input 
                                    className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-purple-500 w-32 md:w-48"
                                    placeholder="Preset Name..."
                                    value={presetName}
                                    onChange={(e) => setPresetName(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={handleSavePreset} className="text-green-400 hover:bg-gray-700 p-1 rounded"><Check size={16}/></button>
                                <button onClick={() => setIsNaming(false)} className="text-red-400 hover:bg-gray-700 p-1 rounded"><X size={16}/></button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setIsNaming(true)}
                                className="flex items-center gap-1 text-xs font-bold text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded transition-colors"
                            >
                                <Save size={14} /> Save Filter
                            </button>
                        )}

                        <div className="relative">
                            <button 
                                onClick={() => setShowPresetsDropdown(!showPresetsDropdown)}
                                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded transition-colors"
                            >
                                <FolderOpen size={14} /> Load Preset
                            </button>

                            {showPresetsDropdown && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl z-50 overflow-hidden">
                                    <div className="p-2 border-b border-gray-700 text-xs font-bold text-gray-500 uppercase">Saved Presets</div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {presets.length === 0 ? (
                                            <p className="p-3 text-sm text-gray-500 text-center">No presets saved.</p>
                                        ) : (
                                            presets.map(preset => (
                                                <div 
                                                    key={preset.id} 
                                                    onClick={() => handleLoadPreset(preset)}
                                                    className="flex justify-between items-center p-3 hover:bg-gray-800 cursor-pointer group border-b border-gray-800 last:border-0"
                                                >
                                                    <span className="text-sm text-gray-300 font-medium truncate pr-2">{preset.name}</span>
                                                    <button 
                                                        onClick={(e) => handleDeletePreset(e, preset.id)}
                                                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-400 flex items-center gap-1"><PieChart size={14}/> Sector</label>
                        <select 
                            className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
                            value={filters.sector}
                            onChange={(e) => setFilters({...filters, sector: e.target.value})}
                        >
                            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-400 flex items-center gap-1"><DollarSign size={14}/> Market Cap</label>
                        <select 
                            className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
                            value={filters.marketCap}
                            onChange={(e) => setFilters({...filters, marketCap: e.target.value})}
                        >
                            {marketCaps.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-400 flex items-center gap-1"><Activity size={14}/> P/E Ratio</label>
                        <select 
                            className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
                            value={filters.peRatio}
                            onChange={(e) => setFilters({...filters, peRatio: e.target.value})}
                        >
                            {peRatios.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                     <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-400 flex items-center gap-1"><Activity size={14}/> Volume</label>
                        <select 
                            className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
                            value={filters.volume}
                            onChange={(e) => setFilters({...filters, volume: e.target.value})}
                        >
                            {volumes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <button 
                    onClick={handleRunScreener}
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Search />}
                    Run Screener
                </button>
            </div>

            <div className="flex-1">
                {error ? (
                    <div className="bg-red-900/20 border border-red-700 p-4 rounded-xl flex items-center gap-3 text-red-300">
                        <AlertCircle /> {error}
                    </div>
                ) : results.length > 0 ? (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
                         <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-900 text-gray-400 text-xs uppercase font-bold tracking-wider border-b border-gray-700">
                                    <tr>
                                        <th className="p-4">Symbol</th>
                                        <th className="p-4">Name</th>
                                        <th className="p-4 text-right">Price</th>
                                        <th className="p-4 text-right">P/E</th>
                                        <th className="p-4 text-right">Market Cap</th>
                                        <th className="p-4 text-right">Volume</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {results.map((stock, idx) => (
                                        <tr key={idx} className="hover:bg-gray-700/50 transition-colors">
                                            <td className="p-4 font-bold text-purple-400">{stock.symbol}</td>
                                            <td className="p-4 font-medium text-gray-200">{stock.name}</td>
                                            <td className="p-4 text-right text-white font-mono">
                                                ₹{Number(stock.price).toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right text-gray-300 font-mono">{stock.peRatio}</td>
                                            <td className="p-4 text-right text-gray-300">{stock.marketCap}</td>
                                            <td className="p-4 text-right text-gray-300">{stock.volume}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : !loading && (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-500 border-2 border-dashed border-gray-700 rounded-xl">
                        <Filter size={48} className="mb-2 opacity-50" />
                        <p>Set your filters above and click "Run Screener" to find stocks.</p>
                    </div>
                )}
            </div>
        </div>
    );
};