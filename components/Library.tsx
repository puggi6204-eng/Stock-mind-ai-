
import React, { useState, useEffect } from 'react';
import { 
    BookOpen, 
    BarChart2, 
    BrainCircuit, 
    Monitor, 
    Image as ImageIcon, 
    Filter, 
    Trash2, 
    ExternalLink, 
    Clock, 
    AlertCircle 
} from 'lucide-react';

interface LibraryProps {
    onOpenItem: (type: 'CHART' | 'DEEP_REPORT' | 'SCREEN_SHOT' | 'MEDIA', data: any) => void;
}

export const Library: React.FC<LibraryProps> = ({ onOpenItem }) => {
    const [activeTab, setActiveTab] = useState<'CHARTS' | 'REPORTS' | 'SCREENS' | 'MEDIA' | 'PRESETS'>('CHARTS');
    const [data, setData] = useState<any[]>([]);

    // Function to load data based on active tab
    const loadData = () => {
        let key = '';
        switch (activeTab) {
            case 'CHARTS': key = 'visual_analysis_history'; break;
            case 'REPORTS': key = 'deep_analysis_history'; break;
            case 'SCREENS': key = 'screen_analysis_history'; break;
            case 'MEDIA': key = 'multimodal_history'; break;
            case 'PRESETS': key = 'stock_screener_presets'; break;
        }

        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                setData(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load library data", e);
                setData([]);
            }
        } else {
            setData([]);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const deleteItem = (id: string) => {
        // Optimistic UI update
        const updated = data.filter((item: any) => (item.id || item.timestamp) !== id); // Use timestamp as fallback ID for older history items
        setData(updated);

        let key = '';
        switch (activeTab) {
            case 'CHARTS': key = 'visual_analysis_history'; break;
            case 'REPORTS': key = 'deep_analysis_history'; break;
            case 'SCREENS': key = 'screen_analysis_history'; break;
            case 'MEDIA': key = 'multimodal_history'; break;
            case 'PRESETS': key = 'stock_screener_presets'; break;
        }
        localStorage.setItem(key, JSON.stringify(updated));
    };

    const clearCategory = () => {
        if (!confirm(`Are you sure you want to delete all ${activeTab}?`)) return;
        setData([]);
        let key = '';
        switch (activeTab) {
            case 'CHARTS': key = 'visual_analysis_history'; break;
            case 'REPORTS': key = 'deep_analysis_history'; break;
            case 'SCREENS': key = 'screen_analysis_history'; break;
            case 'MEDIA': key = 'multimodal_history'; break;
            case 'PRESETS': key = 'stock_screener_presets'; break;
        }
        localStorage.removeItem(key);
    };

    const formatDate = (ts: number) => {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString() + ' ' + new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };

    const TabButton = ({ id, icon: Icon, label }: any) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === id 
                ? 'border-blue-500 text-blue-400 bg-gray-800' 
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
        >
            <Icon size={18} /> {label}
        </button>
    );

    return (
        <div className="p-6 h-full flex flex-col bg-gray-900">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-blue-400">
                    <BookOpen /> My Library
                </h2>
                {data.length > 0 && (
                    <button 
                        onClick={clearCategory}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-900 bg-red-900/20 px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                    >
                        <Trash2 size={14} /> Clear {activeTab}
                    </button>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap border-b border-gray-700 mb-6">
                <TabButton id="CHARTS" icon={BarChart2} label="Charts" />
                <TabButton id="REPORTS" icon={BrainCircuit} label="Deep Reports" />
                <TabButton id="SCREENS" icon={Monitor} label="Screens" />
                <TabButton id="MEDIA" icon={ImageIcon} label="Media" />
                <TabButton id="PRESETS" icon={Filter} label="Screener" />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
                        <AlertCircle size={48} className="mb-4 opacity-50" />
                        <p>No saved {activeTab.toLowerCase().replace('_', ' ')} found.</p>
                        <p className="text-xs mt-2">Items are saved automatically when you use the tools.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.map((item: any, idx: number) => {
                            // Determine display properties based on type
                            const id = item.id || item.timestamp;
                            const title = item.symbol || item.query || item.name || item.prompt || 'Untitled';
                            const subtitle = item.period || (item.filters ? 'Custom Filter' : '');
                            const content = item.result || item.analysis || JSON.stringify(item.filters);
                            
                            return (
                                <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-blue-500/50 transition-all shadow-lg group flex flex-col h-60">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-gray-200 line-clamp-1 text-lg">{title}</h3>
                                            {subtitle && <span className="text-xs bg-gray-700 text-blue-300 px-2 py-0.5 rounded">{subtitle}</span>}
                                        </div>
                                        <button 
                                            onClick={() => deleteItem(id)}
                                            className="text-gray-600 hover:text-red-400 p-1"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-hidden relative mb-4">
                                        <p className="text-sm text-gray-400 line-clamp-4 whitespace-pre-wrap">
                                            {content || "Click to view details..."}
                                        </p>
                                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-800 to-transparent"></div>
                                    </div>

                                    <div className="flex justify-between items-center mt-auto pt-3 border-t border-gray-700">
                                        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                                            <Clock size={10} /> {formatDate(item.timestamp || parseInt(item.id))}
                                        </div>
                                        
                                        {activeTab !== 'PRESETS' && activeTab !== 'MEDIA' && activeTab !== 'SCREENS' && (
                                            <button 
                                                onClick={() => {
                                                    if(activeTab === 'CHARTS') onOpenItem('CHART', item);
                                                    if(activeTab === 'REPORTS') onOpenItem('DEEP_REPORT', item);
                                                }}
                                                className="text-blue-400 hover:text-white flex items-center gap-1 text-xs font-bold uppercase tracking-wide bg-blue-500/10 hover:bg-blue-600/20 px-3 py-1.5 rounded transition-colors"
                                            >
                                                Open <ExternalLink size={12} />
                                            </button>
                                        )}
                                        {/* For Screens and Media, we display content inline or simple alert as they are less interactive to "restore" fully without file blob */}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
