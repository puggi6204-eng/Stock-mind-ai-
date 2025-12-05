
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  BarChart2, 
  BrainCircuit, 
  Mic, 
  Video, 
  Image as ImageIcon, 
  Monitor,
  Menu,
  ArrowUp,
  ArrowDown,
  Activity,
  Search as SearchIcon,
  Filter,
  BookOpen
} from 'lucide-react';
import { View } from './types';
import { MarketChat } from './components/MarketChat';
import { VisualAnalysis } from './components/VisualAnalysis';
import { DeepAnalysis } from './components/DeepAnalysis';
import { LiveConsultant } from './components/LiveConsultant';
import { MarketVideo } from './components/MarketVideo';
import { MultimodalInput } from './components/MultimodalInput';
import { AdvanceScreen } from './components/AdvanceScreen';
import { StockScreener } from './components/StockScreener';
import { Library } from './components/Library';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // State to pass search query from Dashboard to Visual Analysis
  const [targetSymbol, setTargetSymbol] = useState<string>('');
  
  // State to pass pre-filled message to Market Chat (e.g., from Buy/Sell buttons)
  const [chatInitialMessage, setChatInitialMessage] = useState<string>('');

  // State for restoring Deep Analysis
  const [deepAnalysisProps, setDeepAnalysisProps] = useState<{q?: string, r?: string}>({});

  // Handle Deep Linking / URL Params on Mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const symbolParam = params.get('symbol');

    if (viewParam === 'VISUAL_ANALYSIS') {
        setCurrentView(View.VISUAL_ANALYSIS);
        if (symbolParam) {
            setTargetSymbol(symbolParam);
        }
    }
  }, []);

  // Helper to switch to chat with a message
  const handleNavigateToChat = (message: string) => {
      setChatInitialMessage(message);
      setCurrentView(View.MARKET_CHAT);
  };

  // Helper to restore items from Library
  const handleOpenFromLibrary = (type: 'CHART' | 'DEEP_REPORT' | 'SCREEN_SHOT' | 'MEDIA', data: any) => {
      if (type === 'CHART') {
          setTargetSymbol(data.symbol);
          // We can also utilize localStorage for period preferences if needed, but symbol is key
          setCurrentView(View.VISUAL_ANALYSIS);
      } else if (type === 'DEEP_REPORT') {
          setDeepAnalysisProps({ q: data.query, r: data.result });
          setCurrentView(View.DEEP_ANALYSIS);
      }
      // Note: Screens and Media history are best viewed within the Library itself or their respective components' history sidebars
      // as they rely on large text blocks rather than interactive fetch states.
  };

  // Dynamic Dashboard Component
  const Dashboard = () => {
    // Simulated Real-time Data State with LocalStorage Persistence
    const [marketData, setMarketData] = useState(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('dashboard_market_data');
        if (saved) {
          try { return JSON.parse(saved); } catch (e) { console.error("Failed to parse market data", e); }
        }
      }
      return {
        nifty: { value: 24350.20, change: 0.85 },
        sensex: { value: 80100.50, change: 0.75 },
        bankNifty: { value: 52100.00, change: -0.24 },
      };
    });

    const [topStocks, setTopStocks] = useState(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('dashboard_top_stocks');
        if (saved) {
          try { return JSON.parse(saved); } catch (e) { console.error("Failed to parse top stocks", e); }
        }
      }
      return [
        { name: 'TCS', price: 3450.20, change: 2.4 },
        { name: 'Infosys', price: 1650.45, change: 1.8 },
        { name: 'Reliance', price: 2980.10, change: 1.2 },
        { name: 'HDFC Bank', price: 1450.50, change: -0.5 },
        { name: 'Adani Ent', price: 3100.00, change: 0.9 },
      ];
    });
    
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [searchInput, setSearchInput] = useState('');

    // Persist Market Data changes
    useEffect(() => {
      localStorage.setItem('dashboard_market_data', JSON.stringify(marketData));
    }, [marketData]);

    // Persist Top Stocks changes
    useEffect(() => {
      localStorage.setItem('dashboard_top_stocks', JSON.stringify(topStocks));
    }, [topStocks]);

    // Simulation Effect
    useEffect(() => {
        const interval = setInterval(() => {
            // Randomize Indices
            setMarketData((prev: any) => ({
                nifty: { 
                    value: prev.nifty.value * (1 + (Math.random() * 0.001 - 0.0005)), 
                    change: prev.nifty.change + (Math.random() * 0.1 - 0.05) 
                },
                sensex: { 
                    value: prev.sensex.value * (1 + (Math.random() * 0.001 - 0.0005)), 
                    change: prev.sensex.change + (Math.random() * 0.1 - 0.05) 
                },
                bankNifty: { 
                    value: prev.bankNifty.value * (1 + (Math.random() * 0.001 - 0.0005)), 
                    change: prev.bankNifty.change + (Math.random() * 0.1 - 0.05) 
                },
            }));

            // Randomize Stocks
            setTopStocks((prev: any[]) => prev.map(stock => ({
                ...stock,
                price: stock.price * (1 + (Math.random() * 0.002 - 0.001)),
                change: stock.change + (Math.random() * 0.2 - 0.1)
            })));

            setLastUpdated(new Date());
        }, 3000); // Update every 3 seconds

        return () => clearInterval(interval);
    }, []);

    const handleDashboardSearch = () => {
        if(searchInput.trim()) {
            setTargetSymbol(searchInput);
            setCurrentView(View.VISUAL_ANALYSIS);
        }
    };

    // Helper formatters
    const formatNum = (num: number) => num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    const formatChange = (num: number) => {
        const isPos = num >= 0;
        return (
            <span className={`${isPos ? 'text-green-400' : 'text-red-400'} text-sm font-semibold flex items-center gap-1`}>
                {isPos ? <ArrowUp size={14}/> : <ArrowDown size={14}/>} {Math.abs(num).toFixed(2)}%
            </span>
        );
    };

    return (
        <div className="p-6 h-full overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">Market Dashboard</h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full border border-gray-700">
                    <Activity size={16} className="text-green-500 animate-pulse" />
                    <span className="text-xs text-gray-400 font-mono">LIVE FEED • {lastUpdated.toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Prominent Search Bar */}
            <div className="mb-8 relative max-w-2xl">
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-50 group-hover:opacity-75 transition duration-200 blur"></div>
                    <div className="relative flex items-center bg-gray-900 rounded-xl">
                        <SearchIcon className="absolute left-4 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            className="w-full bg-transparent border-none text-white pl-12 pr-4 py-4 focus:ring-0 text-lg placeholder-gray-500"
                            placeholder="Search for a stock symbol to analyze (e.g., RELIANCE, TCS)..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDashboardSearch()}
                        />
                        <button 
                            onClick={handleDashboardSearch}
                            className="absolute right-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-gray-700"
                        >
                            Analyze
                        </button>
                    </div>
                </div>
            </div>

            {/* Indices Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                    { label: 'NIFTY 50', data: marketData.nifty },
                    { label: 'SENSEX', data: marketData.sensex },
                    { label: 'BANK NIFTY', data: marketData.bankNifty }
                ].map((item, idx) => (
                    <div key={idx} className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all shadow-lg hover:shadow-blue-500/10 group">
                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">{item.label}</h3>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-white tracking-tight">{formatNum(item.data.value)}</span>
                            {formatChange(item.data.change)}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Movers */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="text-lg font-bold mb-5 flex items-center gap-2 border-b border-gray-700 pb-3">
                        <BarChart2 className="text-blue-400" size={20} /> Top Market Movers
                    </h3>
                    <ul className="space-y-4">
                        {topStocks.map((stock: any, idx: number) => (
                            <li key={idx} className="flex justify-between items-center hover:bg-gray-700/30 p-2 rounded-lg transition-colors cursor-pointer" onClick={() => {
                                setTargetSymbol(stock.name);
                                setCurrentView(View.VISUAL_ANALYSIS);
                            }}>
                                <div>
                                    <span className="font-bold block text-gray-200">{stock.name}</span>
                                    <span className="text-xs text-gray-500">₹{formatNum(stock.price)}</span>
                                </div>
                                {formatChange(stock.change)}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Market Sentiment */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
                    <h3 className="text-lg font-bold mb-5 flex items-center gap-2 border-b border-gray-700 pb-3">
                        <BrainCircuit className="text-purple-400" size={20} /> AI Market Sentiment
                    </h3>
                    <div className="flex-1 flex flex-col items-center justify-center relative min-h-[200px]">
                        {/* Gauge Visual */}
                        <div className="w-56 h-28 overflow-hidden relative mb-4">
                            <div className="w-full h-full bg-gray-700 rounded-t-full relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-20"></div>
                            </div>
                            {/* Needle */}
                            <div 
                                className="absolute bottom-0 left-1/2 w-1 h-full bg-white origin-bottom transition-transform duration-700 ease-out"
                                style={{ 
                                    transform: `translateX(-50%) rotate(${(marketData.nifty.change * 25)}deg)` 
                                }}
                            >
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_red]"></div>
                            </div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-2 bg-gray-900 rounded-t-full z-10"></div>
                        </div>

                        <div className="text-center">
                            <div className={`text-4xl font-bold transition-colors duration-500 ${marketData.nifty.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {marketData.nifty.change >= 0.5 ? 'Strong Buy' : marketData.nifty.change >= 0 ? 'Bullish' : 'Bearish'}
                            </div>
                            <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
                                Institutional flows suggest {marketData.nifty.change >= 0 ? 'positive' : 'negative'} momentum in large-cap indices.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case View.DASHBOARD: return <Dashboard />;
      case View.MARKET_CHAT: return <MarketChat initialMessage={chatInitialMessage} />;
      case View.VISUAL_ANALYSIS: return <VisualAnalysis initialSymbol={targetSymbol} onNavigateToChat={handleNavigateToChat} />;
      case View.DEEP_ANALYSIS: return <DeepAnalysis initialQuery={deepAnalysisProps.q} initialResult={deepAnalysisProps.r} />;
      case View.LIVE_CONSULTANT: return <LiveConsultant />;
      case View.MARKET_VIDEO: return <MarketVideo />;
      case View.MULTIMODAL_INPUT: return <MultimodalInput />;
      case View.ADVANCE_SCREEN: return <AdvanceScreen />;
      case View.STOCK_SCREENER: return <StockScreener />;
      case View.LIBRARY: return <Library onOpenItem={handleOpenFromLibrary} />;
      default: return <Dashboard />;
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: View, icon: any, label: string }) => (
    <button 
      onClick={() => { setCurrentView(view); setMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === view ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen w-full bg-gray-900 text-gray-100 font-sans">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 md:relative md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">StockSage AI</h1>
        </div>
        <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100%-80px)]">
          <NavItem view={View.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
          <NavItem view={View.MARKET_CHAT} icon={MessageSquare} label="Market Chat" />
          <NavItem view={View.STOCK_SCREENER} icon={Filter} label="Stock Screener" />
          <NavItem view={View.VISUAL_ANALYSIS} icon={BarChart2} label="Visual Analysis" />
          <NavItem view={View.DEEP_ANALYSIS} icon={BrainCircuit} label="Deep Analysis" />
          <NavItem view={View.LIVE_CONSULTANT} icon={Mic} label="Live Consultant" />
          <NavItem view={View.MARKET_VIDEO} icon={Video} label="Market Video" />
          <NavItem view={View.MULTIMODAL_INPUT} icon={ImageIcon} label="Photo/Video Input" />
          <NavItem view={View.ADVANCE_SCREEN} icon={Monitor} label="Advance AI (Screen)" />
          
          <div className="pt-4 mt-4 border-t border-gray-800">
            <NavItem view={View.LIBRARY} icon={BookOpen} label="My Library" />
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900">
            <span className="font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">StockSage AI</span>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-300"><Menu /></button>
        </div>

        <main className="flex-1 overflow-hidden relative bg-gray-900">
            {renderContent()}
        </main>
      </div>
      
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default App;