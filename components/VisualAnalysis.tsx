
import React, { useState, useEffect, useRef } from 'react';
import { Search, BarChart2, Loader2, AlertCircle, Plus, Check, History, Clock, Trash2, X, Bell, BellRing, Palette, Wifi, WifiOff, GitCompare, Share2 } from 'lucide-react';
import { getGraphData } from '../services/geminiService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, Legend } from 'recharts';

interface VisualAnalysisProps {
    initialSymbol?: string;
    onNavigateToChat?: (message: string) => void;
}

interface HistoryItem {
    symbol: string;
    period: string;
    data: any[];
    timestamp: number;
}

interface PriceAlert {
    id: string;
    symbol: string;
    targetPrice: number;
    createdAt: number;
}

const PERIODS = ['1W', '1M', '3M', '6M', '1Y'];

const CHART_COLORS = [
    { name: 'Emerald', value: '#10B981' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Rose', value: '#F43F5E' },
];

// --- Mock WebSocket Class for Simulation ---
class MockWebSocket {
    url: string;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    private intervalId: NodeJS.Timeout | null = null;

    constructor(url: string) {
        this.url = url;
        // Simulate network latency for connection (Reduced for speed)
        setTimeout(() => {
            if (this.onopen) this.onopen();
            this.startStream();
        }, 300);
    }

    private startStream() {
        this.intervalId = setInterval(() => {
            if (this.onmessage) {
                // Simulate a price tick (random small percentage change)
                const change = (Math.random() - 0.5) * 0.004; // +/- 0.2% volatility
                const payload = JSON.stringify({ type: 'TICK', change });
                this.onmessage({ data: payload });
            }
        }, 1000); // 1 tick per second
    }

    close() {
        if (this.intervalId) clearInterval(this.intervalId);
        if (this.onclose) this.onclose();
    }
}

// Technical Indicator Helper
const enrichDataWithIndicators = (rawData: any[]) => {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];
    
    // Deep copy to avoid mutating original references immediately
    const enriched = rawData.map(item => ({ ...item, value: Number(item.value) }));
    
    const rsiPeriod = 14;
    const smaPeriod = 20;
    
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < enriched.length; i++) {
        const current = enriched[i];
        const price = current.value;
        
        // --- Calculate SMA (20) ---
        if (i >= smaPeriod - 1) {
            let sum = 0;
            for (let j = 0; j < smaPeriod; j++) {
                sum += enriched[i - j].value;
            }
            current.sma = sum / smaPeriod;
        } else {
            current.sma = null;
        }

        // --- Calculate RSI (14) ---
        if (i > 0) {
            const prevPrice = enriched[i - 1].value;
            const change = price - prevPrice;
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? Math.abs(change) : 0;

            if (i <= rsiPeriod) {
                // Simple Average for the first 'period'
                avgGain += gain;
                avgLoss += loss;
                
                if (i === rsiPeriod) {
                    const firstAvgGain = avgGain / rsiPeriod;
                    const firstAvgLoss = avgLoss / rsiPeriod;
                    const rs = firstAvgLoss === 0 ? 100 : firstAvgGain / firstAvgLoss;
                    current.rsi = 100 - (100 / (1 + rs));
                    
                    // Store for next iteration (Wilder's Smoothing)
                    avgGain = firstAvgGain;
                    avgLoss = firstAvgLoss;
                } else {
                    current.rsi = null;
                }
            } else {
                // Wilder's Smoothing Method
                avgGain = ((avgGain * (rsiPeriod - 1)) + gain) / rsiPeriod;
                avgLoss = ((avgLoss * (rsiPeriod - 1)) + loss) / rsiPeriod;
                
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                current.rsi = 100 - (100 / (1 + rs));
            }
        } else {
            current.rsi = null;
        }
    }
    return enriched;
};

export const VisualAnalysis: React.FC<VisualAnalysisProps> = ({ initialSymbol, onNavigateToChat }) => {
  const [symbol, setSymbol] = useState(initialSymbol || '');
  
  // Lazy initialization for period from URL or localStorage
  const [period, setPeriod] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const p = params.get('period');
          if (p && PERIODS.includes(p)) return p;

          const saved = localStorage.getItem('chart_period');
          return (saved && PERIODS.includes(saved)) ? saved : '1M';
      }
      return '1M';
  });

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedSymbol, setSearchedSymbol] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Lazy initialization for chartColor from URL or localStorage
  const [chartColor, setChartColor] = useState(() => {
       if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const c = params.get('color');
          if (c) return '#' + c;

          return localStorage.getItem('chart_color') || '#10B981';
      }
      return '#10B981';
  });
  
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Comparison State
  const [comparisons, setComparisons] = useState<string[]>([]);
  const [compareInput, setCompareInput] = useState('');
  const [showCompareInput, setShowCompareInput] = useState(false);
  // Chart Visibility Toggle
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  // Watchlist State
  const [isWatchlisted, setIsWatchlisted] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Alert State
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showAlertInput, setShowAlertInput] = useState(false);
  const [newAlertPrice, setNewAlertPrice] = useState('');
  const [triggeredAlert, setTriggeredAlert] = useState<PriceAlert | null>(null);
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'ALERTS'>('HISTORY');

  // Live Stream State
  const [isLive, setIsLive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const socketRef = useRef<MockWebSocket | null>(null);

  // Share UI State
  const [showShareToast, setShowShareToast] = useState(false);

  // --- Persist User Preferences ---
  useEffect(() => {
    if (period) {
        localStorage.setItem('chart_period', period);
    }
  }, [period]);

  useEffect(() => {
    if (chartColor) {
        localStorage.setItem('chart_color', chartColor);
    }
  }, [chartColor]);

  // Load History & Alerts
  useEffect(() => {
    // Load history
    const savedHistory = localStorage.getItem('visual_analysis_history');
    if (savedHistory) {
        try { setHistory(JSON.parse(savedHistory)); } catch (e) { console.error(e); }
    }
    // Load alerts
    const savedAlerts = localStorage.getItem('price_alerts');
    if (savedAlerts) {
        try { setAlerts(JSON.parse(savedAlerts)); } catch (e) { console.error(e); }
    }
    
    // Check URL for comparisons on mount
    const params = new URLSearchParams(window.location.search);
    const comps = params.get('comparisons');
    if (comps) {
        setComparisons(comps.split(','));
    }
  }, []);

  // Handle Initial Props / URL Logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSymbol = params.get('symbol');
    const urlComparisons = params.get('comparisons') ? params.get('comparisons')?.split(',') : [];

    const target = urlSymbol || initialSymbol || symbol;
    const comps = urlComparisons && urlComparisons.length > 0 ? urlComparisons : comparisons;
    
    if (target) {
        setSymbol(target);
        fetchAllData(target, comps || [], period);
        checkWatchlist(target);
    }
  }, [initialSymbol]);

  // Check alerts whenever data is updated
  useEffect(() => {
      if (data.length > 0 && searchedSymbol) {
          const currentPrice = Number(data[data.length - 1].value);
          if (isNaN(currentPrice)) return;

          const relevantAlerts = alerts.filter(a => a.symbol === searchedSymbol.toUpperCase());
          
          relevantAlerts.forEach(alert => {
              if (currentPrice >= alert.targetPrice) {
                  setTriggeredAlert(alert);
              }
          });
      }
  }, [data, searchedSymbol, alerts]);

  // WebSocket Live Stream Handling
  useEffect(() => {
      if (isLive) {
          setConnectionStatus('CONNECTING');
          const ws = new MockWebSocket('wss://stream.stocksage.ai/feed');
          
          ws.onopen = () => {
            setConnectionStatus('CONNECTED');
          };

          ws.onmessage = (event) => {
            const { change } = JSON.parse(event.data);
            
            setData(prevData => {
                if (prevData.length === 0) return prevData;
                
                const lastItem = prevData[prevData.length - 1];
                const lastPrice = Number(lastItem.value);
                const newPrice = lastPrice * (1 + change);
                
                const newPoint: any = {
                    date: new Date().toISOString(),
                    value: Number(newPrice.toFixed(2))
                };

                // Update Comparisons with same volatility simulation
                comparisons.forEach(comp => {
                    if (lastItem[comp]) {
                        const compLastPrice = Number(lastItem[comp]);
                        const compChange = (Math.random() - 0.5) * 0.004;
                        newPoint[comp] = Number((compLastPrice * (1 + compChange)).toFixed(2));
                    }
                });
                
                // Sliding Window: Keep last 100 points to prevent chart compression
                const newData = [...prevData, newPoint];
                if (newData.length > 100) newData.shift();
                
                return enrichDataWithIndicators(newData);
            });
          };

          socketRef.current = ws;
      } else {
          if (socketRef.current) {
              socketRef.current.close();
              socketRef.current = null;
          }
          setConnectionStatus('DISCONNECTED');
      }

      return () => {
          if (socketRef.current) {
              socketRef.current.close();
          }
      };
  }, [isLive, comparisons]);

  const handleColorChange = (color: string) => {
      setChartColor(color);
      setShowColorPicker(false);
  };

  const handleShare = () => {
    if (!searchedSymbol) return;
    
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('view', 'VISUAL_ANALYSIS');
    url.searchParams.set('symbol', searchedSymbol);
    url.searchParams.set('period', period);
    url.searchParams.set('color', chartColor.replace('#', ''));
    if (comparisons.length > 0) {
        url.searchParams.set('comparisons', comparisons.join(','));
    }

    navigator.clipboard.writeText(url.toString()).then(() => {
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
    });
  };

  const checkWatchlist = (sym: string) => {
      const saved = localStorage.getItem('watchlist');
      if (saved && sym) {
          const list = JSON.parse(saved);
          setIsWatchlisted(list.includes(sym.toUpperCase()));
      } else {
          setIsWatchlisted(false);
      }
  };

  const toggleWatchlist = () => {
      if (!searchedSymbol) return;
      const term = searchedSymbol.toUpperCase();
      const saved = localStorage.getItem('watchlist');
      let list = saved ? JSON.parse(saved) : [];
      
      if (list.includes(term)) {
          list = list.filter((s: string) => s !== term);
          setIsWatchlisted(false);
      } else {
          list.push(term);
          setIsWatchlisted(true);
      }
      localStorage.setItem('watchlist', JSON.stringify(list));
      window.dispatchEvent(new Event("storage"));
      checkWatchlist(term);
  };

  const addToHistory = (sym: string, per: string, chartData: any[]) => {
      const newItem: HistoryItem = { symbol: sym, period: per, data: chartData, timestamp: Date.now() };
      setHistory(prev => {
          const filtered = prev.filter(item => !(item.symbol === sym && item.period === per));
          const updated = [newItem, ...filtered].slice(10);
          localStorage.setItem('visual_analysis_history', JSON.stringify(updated));
          return updated;
      });
  };

  const handleAddAlert = () => {
      const price = parseFloat(newAlertPrice);
      if (!searchedSymbol || isNaN(price)) return;

      const newAlert: PriceAlert = {
          id: Date.now().toString(),
          symbol: searchedSymbol.toUpperCase(),
          targetPrice: price,
          createdAt: Date.now()
      };

      const updated = [newAlert, ...alerts];
      setAlerts(updated);
      localStorage.setItem('price_alerts', JSON.stringify(updated));
      setNewAlertPrice('');
      setShowAlertInput(false);
      setActiveTab('ALERTS');
  };

  const removeAlert = (id: string) => {
      const updated = alerts.filter(a => a.id !== id);
      setAlerts(updated);
      localStorage.setItem('price_alerts', JSON.stringify(updated));
  };

  const deleteHistoryItem = (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      const updated = history.filter((_, i) => i !== index);
      setHistory(updated);
      localStorage.setItem('visual_analysis_history', JSON.stringify(updated));
  };

  const loadHistoryItem = (item: HistoryItem) => {
      setSymbol(item.symbol);
      setSearchedSymbol(item.symbol);
      setPeriod(item.period);
      setComparisons([]);
      setHiddenSeries([]);
      setIsLive(false); 
      setData(enrichDataWithIndicators(item.data));
      setError(null);
      checkWatchlist(item.symbol);
  };

  const handleAddComparison = () => {
      if (!compareInput.trim() || comparisons.includes(compareInput.toUpperCase()) || comparisons.length >= 2) return;
      const newComparisons = [...comparisons, compareInput.toUpperCase()];
      setComparisons(newComparisons);
      setCompareInput('');
      setShowCompareInput(false);
      
      fetchAllData(searchedSymbol, newComparisons, period);
  };

  const handleRemoveComparison = (compToRemove: string) => {
      const newComparisons = comparisons.filter(c => c !== compToRemove);
      setComparisons(newComparisons);
      setHiddenSeries(prev => prev.filter(s => s !== compToRemove));
      fetchAllData(searchedSymbol, newComparisons, period);
  };

  const fetchAllData = async (mainSym: string, compSyms: string[], currPeriod: string) => {
    const term = mainSym.trim();
    if (!term) return;
    
    // Check cache first for main symbol (if no comparisons to keep it simple or implement deeper cache logic)
    if (compSyms.length === 0) {
        const savedHistory = localStorage.getItem('visual_analysis_history');
        if (savedHistory) {
            const hist: HistoryItem[] = JSON.parse(savedHistory);
            const cached = hist.find(h => h.symbol === term.toUpperCase() && h.period === currPeriod);
            // Valid if less than 5 minutes old
            if (cached && (Date.now() - cached.timestamp < 300000)) {
                setSearchedSymbol(term);
                setPeriod(currPeriod);
                setData(enrichDataWithIndicators(cached.data));
                setComparisons([]);
                setHiddenSeries([]);
                setIsLive(false);
                setError(null);
                checkWatchlist(term);
                setLoading(false);
                return;
            }
        }
    }

    setLoading(true);
    setSearchedSymbol(term);
    setHiddenSeries([]); // Reset hidden series on new fetch
    setIsLive(false); 
    setError(null);
    checkWatchlist(term);

    try {
        const mainResult = await getGraphData(term, currPeriod);
        
        if (!mainResult || !Array.isArray(mainResult) || mainResult.length === 0) {
            setError("Unable to fetch data for the main symbol.");
            setData([]);
            setLoading(false);
            return;
        }

        let mergedData = mainResult
            .filter(item => item.date && item.value !== undefined)
            .map(item => ({ date: item.date, value: Number(item.value) }));
            
        if (compSyms && compSyms.length > 0) {
            const comparisonPromises = compSyms.map(sym => getGraphData(sym, currPeriod));
            const comparisonResults = await Promise.all(comparisonPromises);
            
            mergedData = mergedData.map(point => {
                const newPoint: any = { ...point };
                
                comparisonResults.forEach((res, idx) => {
                    const compSym = compSyms[idx];
                    if (Array.isArray(res)) {
                        const match = res.find((p: any) => p.date === point.date);
                        if (match) {
                            newPoint[compSym] = Number(match.value);
                        }
                    }
                });
                return newPoint;
            });
        }

        const sorted = mergedData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const enrichedData = enrichDataWithIndicators(sorted);
        
        setData(enrichedData);
        if (!compSyms || compSyms.length === 0) {
            addToHistory(term.toUpperCase(), currPeriod, enrichedData);
        }

    } catch (e) {
        console.error(e);
        setError("Error analyzing market data.");
    } finally {
        setLoading(false);
    }
  };

  const handleSearchWrapper = (overridePeriod?: string) => {
      const p = overridePeriod || period;
      if (overridePeriod) {
          setPeriod(overridePeriod);
      }
      fetchAllData(symbol, comparisons, p);
  };

  const formatTimeAgo = (timestamp: number) => {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return '1d+ ago';
  };

  const getComparisonColor = (index: number) => {
      const available = CHART_COLORS.filter(c => c.value.toLowerCase() !== chartColor.toLowerCase());
      return available[index % available.length].value;
  };

  // Legend click handler to toggle series visibility
  const handleLegendClick = (e: any) => {
      const { value } = e;
      setHiddenSeries(prev => 
          prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
      );
  };

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
          const point = payload[0].payload;
          const dateStr = new Date(point.date).toLocaleDateString(undefined, { 
              weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
              hour: isLive ? '2-digit' : undefined, minute: isLive ? '2-digit' : undefined, second: isLive ? '2-digit' : undefined
          });

          return (
              <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl backdrop-blur-md bg-opacity-95 min-w-[200px]">
                  <p className="text-gray-400 text-xs mb-2 font-medium">{dateStr}</p>
                  
                  {!hiddenSeries.includes(searchedSymbol.toUpperCase()) && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-400 uppercase font-bold">{searchedSymbol}</p>
                        <p className="text-2xl font-bold text-white" style={{ color: chartColor }}>
                            ₹{Number(point.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                  )}

                  {comparisons.map((comp, idx) => {
                      if (hiddenSeries.includes(comp.toUpperCase())) return null;
                      const val = point[comp];
                      if (val === undefined) return null;
                      return (
                        <div key={comp} className="mb-2 border-t border-gray-800 pt-2">
                            <p className="text-xs text-gray-400 uppercase font-bold">{comp}</p>
                            <p className="text-lg font-bold" style={{ color: getComparisonColor(idx) }}>
                                ₹{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                      );
                  })}
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs border-t border-gray-700 pt-3 mt-2">
                      <div className="flex flex-col">
                          <span className="text-gray-500 uppercase tracking-wider font-bold text-[10px]">RSI (14)</span>
                          <span className={`font-bold text-sm ${
                              point.rsi >= 70 ? 'text-red-400' : point.rsi <= 30 ? 'text-green-400' : 'text-blue-300'
                          }`}>
                              {point.rsi ? point.rsi.toFixed(1) : 'N/A'}
                          </span>
                      </div>
                      <div className="flex flex-col">
                          <span className="text-gray-500 uppercase tracking-wider font-bold text-[10px]">SMA (20)</span>
                          <span className="font-bold text-sm text-yellow-400">
                              {point.sma ? `₹${point.sma.toFixed(2)}` : 'N/A'}
                          </span>
                      </div>
                  </div>
              </div>
          );
      }
      return null;
  };

  return (
    <div className="p-6 h-full flex flex-col relative">
      {/* Triggered Alert Notification */}
      {triggeredAlert && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-bounce">
              <BellRing size={24} className="animate-pulse" />
              <div>
                  <h4 className="font-bold">Price Alert Triggered!</h4>
                  <p className="text-sm">{triggeredAlert.symbol} has crossed {triggeredAlert.targetPrice}</p>
              </div>
              <button onClick={() => setTriggeredAlert(null)} className="ml-4 hover:bg-green-700 p-1 rounded">
                  <X size={18} />
              </button>
          </div>
      )}

       {/* Share Toast */}
       {showShareToast && (
          <div className="absolute top-4 right-6 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl animate-fade-in flex items-center gap-2">
              <Check size={16} /> Link Copied to Clipboard!
          </div>
      )}

      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-green-400">
        <BarChart2 /> Visual Analysis
      </h2>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 flex gap-2">
            <input 
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Enter Stock Symbol (e.g., RELIANCE)"
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 flex-1 text-lg focus:ring-2 focus:ring-green-500 outline-none w-full"
            onKeyDown={(e) => e.key === 'Enter' && handleSearchWrapper()}
            />
            <button 
            onClick={() => handleSearchWrapper()}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
            {loading ? <Loader2 className="animate-spin" /> : <Search />} 
            <span className="hidden md:inline">Analyze</span>
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
          {/* Chart Container */}
          <div className="flex-1 bg-gray-800 rounded-xl p-6 border border-gray-700 relative flex flex-col min-h-[400px]">
            {loading && (
                <div className="absolute inset-0 z-20 bg-gray-800/80 flex items-center justify-center rounded-xl">
                    <Loader2 className="animate-spin text-green-500 w-12 h-12" />
                </div>
            )}

            {searchedSymbol && !error && !loading && (
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                                {searchedSymbol.toUpperCase()}
                                {isLive && connectionStatus === 'CONNECTED' && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                                {isLive && connectionStatus === 'CONNECTING' && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span></span>}
                            </h3>
                            {/* Buy / Sell Action Buttons */}
                            {onNavigateToChat && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onNavigateToChat(`What is a good entry price to BUY ${searchedSymbol}?`)}
                                        className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-600 px-3 py-1 rounded-full text-xs font-bold uppercase transition-all"
                                    >
                                        Buy
                                    </button>
                                    <button 
                                        onClick={() => onNavigateToChat(`Is it a good time to SELL ${searchedSymbol}?`)}
                                        className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600 px-3 py-1 rounded-full text-xs font-bold uppercase transition-all"
                                    >
                                        Sell
                                    </button>
                                </div>
                            )}
                        </div>
                        {comparisons.length > 0 && (
                            <div className="flex gap-2">
                                {comparisons.map((comp, idx) => (
                                    <span key={comp} className="text-xs px-2 py-0.5 rounded flex items-center gap-1 bg-gray-900 border border-gray-600 text-gray-300">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getComparisonColor(idx) }}></span>
                                        vs {comp}
                                        <button onClick={() => handleRemoveComparison(comp)} className="hover:text-white"><X size={10} /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <p className="text-sm text-gray-400">
                             {isLive ? (connectionStatus === 'CONNECTING' ? 'Connecting to Stream...' : 'Live Stream') : `Historical Performance (${period})`}
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 md:gap-4">
                        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                            {PERIODS.map((p) => (
                                <button
                                    key={p}
                                    onClick={() => handleSearchWrapper(p)}
                                    disabled={isLive}
                                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                                        period === p 
                                        ? 'bg-gray-700 text-white shadow-md border border-gray-500' 
                                        : 'text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30'
                                    }`}
                                    style={period === p && !isLive ? { backgroundColor: chartColor, borderColor: chartColor } : {}}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleShare}
                                className="flex items-center justify-center p-2 rounded-lg border bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300 transition-colors"
                                title="Share Chart"
                            >
                                <Share2 size={16} />
                            </button>

                            {/* Live Toggle */}
                            <button
                                onClick={() => setIsLive(!isLive)}
                                className={`flex items-center justify-center p-2 rounded-lg border transition-all ${
                                    isLive 
                                    ? (connectionStatus === 'CONNECTED' ? 'bg-red-900/40 border-red-500 text-red-500 animate-pulse' : 'bg-yellow-900/30 border-yellow-500 text-yellow-400 animate-pulse') 
                                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                                title={isLive ? "Stop Live Feed" : "Start Live Feed"}
                            >
                                {isLive ? <Wifi size={16} /> : <WifiOff size={16} />}
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setShowCompareInput(!showCompareInput)}
                                    className={`flex items-center justify-center p-2 rounded-lg border transition-all ${showCompareInput ? 'bg-gray-600 border-gray-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                                    title="Compare Stocks"
                                >
                                    <GitCompare size={16} />
                                </button>
                                {showCompareInput && (
                                    <div className="absolute top-full right-0 mt-2 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-xl z-30 w-56 flex gap-2">
                                        <input 
                                            value={compareInput}
                                            onChange={(e) => setCompareInput(e.target.value)}
                                            placeholder="Symbol"
                                            className="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm text-white focus:outline-none"
                                        />
                                        <button 
                                            onClick={handleAddComparison}
                                            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-2"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setShowColorPicker(!showColorPicker)}
                                    className="flex items-center justify-center p-2 rounded-lg border bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                                    title="Change Chart Color"
                                >
                                    <Palette size={16} style={{ color: chartColor }} />
                                </button>
                                {showColorPicker && (
                                    <div className="absolute top-full right-0 mt-2 bg-gray-900 border border-gray-600 rounded-lg p-2 shadow-xl z-30 flex gap-2">
                                        {CHART_COLORS.map(c => (
                                            <button
                                                key={c.name}
                                                onClick={() => handleColorChange(c.value)}
                                                className={`w-6 h-6 rounded-full border border-gray-600 hover:scale-110 transition-transform ${chartColor === c.value ? 'ring-2 ring-white' : ''}`}
                                                style={{ backgroundColor: c.value }}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <button 
                                    onClick={() => setShowAlertInput(!showAlertInput)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                                        showAlertInput
                                        ? 'bg-yellow-900/30 border-yellow-500 text-yellow-400' 
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    <Bell size={16} />
                                    <span className="hidden sm:inline text-sm font-bold">Alert</span>
                                </button>
                                
                                {showAlertInput && (
                                    <div className="absolute top-full right-0 mt-2 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-xl z-30 w-48 animate-fade-in">
                                        <p className="text-xs text-gray-400 mb-2">Notify when price crosses:</p>
                                        <input 
                                            type="number" 
                                            value={newAlertPrice}
                                            onChange={(e) => setNewAlertPrice(e.target.value)}
                                            placeholder="Target Price"
                                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white mb-2 focus:border-yellow-500 outline-none"
                                        />
                                        <button 
                                            onClick={handleAddAlert}
                                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold py-2 rounded"
                                        >
                                            Set Alert
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={toggleWatchlist}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                                    isWatchlisted 
                                    ? 'bg-blue-900/30 border-blue-500 text-blue-400' 
                                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {isWatchlisted ? <Check size={16} /> : <Plus size={16} />}
                                <span className="hidden sm:inline text-sm font-bold">Watch</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-[300px] relative w-full">
                {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-2">
                    <AlertCircle size={32} />
                    <p>{error}</p>
                    <p className="text-sm text-gray-500">Please try again or use a different symbol.</p>
                </div>
                ) : data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartColor} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                        </linearGradient>
                        </defs>
                        <Legend 
                            verticalAlign="top" 
                            height={36}
                            iconType="circle"
                            onClick={handleLegendClick}
                            formatter={(value, entry: any) => (
                                <span style={{ 
                                    color: entry.color, 
                                    fontWeight: 'bold', 
                                    textTransform: 'uppercase', 
                                    marginRight: 10,
                                    textDecoration: hiddenSeries.includes(value) ? 'line-through' : 'none',
                                    opacity: hiddenSeries.includes(value) ? 0.5 : 1,
                                    cursor: 'pointer'
                                }}>
                                    {value}
                                </span>
                            )}
                        />
                        <XAxis 
                            dataKey="date" 
                            stroke="#9CA3AF" 
                            minTickGap={30}
                            tickFormatter={(val) => {
                                try {
                                    const d = new Date(val);
                                    if (isLive) {
                                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                    }
                                    if (period === '1Y') {
                                        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                                    }
                                    return `${d.getDate()}/${d.getMonth()+1}`;
                                } catch { return val; }
                            }}
                        />
                        <YAxis 
                            stroke="#9CA3AF" 
                            domain={['auto', 'auto']} 
                            width={60}
                            tickFormatter={(val) => Number(val).toLocaleString()}
                        />
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: '4 4' }} />
                        
                        {/* Main Stock Area */}
                        <Area 
                            name={searchedSymbol.toUpperCase()}
                            type="monotone" 
                            dataKey="value" 
                            stroke={chartColor} 
                            strokeWidth={4} 
                            fillOpacity={1} 
                            fill="url(#colorValue)" 
                            isAnimationActive={!isLive} 
                            animationDuration={1500}
                            animationEasing="ease-in-out"
                            hide={hiddenSeries.includes(searchedSymbol.toUpperCase())}
                        />
                        
                        {/* Comparison Lines */}
                        {comparisons.map((comp, idx) => (
                             <Area 
                                key={comp}
                                name={comp.toUpperCase()}
                                type="monotone" 
                                dataKey={comp}
                                stroke={getComparisonColor(idx)} 
                                strokeWidth={3} 
                                fillOpacity={0.1} 
                                fill={getComparisonColor(idx)}
                                isAnimationActive={!isLive} 
                                animationDuration={1500}
                                animationEasing="ease-in-out"
                                hide={hiddenSeries.includes(comp.toUpperCase())}
                            />
                        ))}

                        <Brush 
                            dataKey="date" 
                            height={30} 
                            stroke={chartColor} 
                            fill="#1F2937"
                            tickFormatter={(val) => {
                                 try {
                                    const d = new Date(val);
                                    if(isLive) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    return `${d.getDate()}/${d.getMonth()+1}`;
                                } catch { return ""; }
                            }}
                        />
                    </AreaChart>
                    </ResponsiveContainer>
                ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    {!loading && "Enter a symbol to visualize the recent trend graph."}
                </div>
                )}
            </div>
          </div>
          
          {/* Sidebar Tabs */}
          <div className="w-full lg:w-72 flex flex-col gap-4 animate-fade-in">
                <div className="flex border-b border-gray-700">
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider ${activeTab === 'HISTORY' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
                    >
                        History
                    </button>
                    <button 
                        onClick={() => setActiveTab('ALERTS')}
                        className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider ${activeTab === 'ALERTS' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}
                    >
                        Active Alerts
                    </button>
                </div>

                 {activeTab === 'HISTORY' ? (
                     <>
                        <div className="flex items-center justify-between">
                            <h3 className="text-gray-400 font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                                <History size={14} /> Recent Analysis
                            </h3>
                            <button 
                                onClick={() => { setHistory([]); localStorage.removeItem('visual_analysis_history'); }}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                                Clear All
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {history.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No recent history.</p>}
                            {history.map((item, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => loadHistoryItem(item)}
                                    className={`group p-3 rounded-xl border cursor-pointer transition-all ${
                                        searchedSymbol === item.symbol && period === item.period
                                        ? 'bg-gray-800 border-green-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                                        : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-bold text-gray-200 block">{item.symbol}</span>
                                            <span className="text-xs text-blue-400 font-medium px-1.5 py-0.5 bg-blue-400/10 rounded">{item.period}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => deleteHistoryItem(e, idx)}
                                            className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Clock size={10} /> {formatTimeAgo(item.timestamp)}
                                    </div>
                                </div>
                            ))}
                        </div>
                     </>
                 ) : (
                     <>
                        <div className="flex items-center justify-between">
                            <h3 className="text-gray-400 font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                                <BellRing size={14} /> Price Targets
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {alerts.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No active alerts set.</p>}
                            {alerts.map((alert) => (
                                <div key={alert.id} className="bg-gray-800/50 border border-gray-700 p-3 rounded-xl flex justify-between items-center">
                                    <div>
                                        <span className="font-bold text-gray-200 block">{alert.symbol}</span>
                                        <span className="text-xs text-yellow-400 font-mono">Target: {alert.targetPrice}</span>
                                    </div>
                                    <button onClick={() => removeAlert(alert.id)} className="text-gray-500 hover:text-red-400">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                     </>
                 )}
            </div>
      </div>
    </div>
  );
};
