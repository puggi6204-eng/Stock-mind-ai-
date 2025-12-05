
import React, { useState, useRef, useEffect } from 'react';
import { Send, TrendingUp, Loader2, LineChart as ChartIcon, AlertTriangle, Mic, MicOff, Link as LinkIcon, ExternalLink, Trash2, History } from 'lucide-react';
import { sendMarketChatMessage } from '../services/geminiService';
import { ChatMessage } from '../types';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MarketChatProps {
    initialMessage?: string;
}

export const MarketChat: React.FC<MarketChatProps> = ({ initialMessage }) => {
  // Initialize from LocalStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('market_chat_history');
          if (saved) {
              try {
                  const parsed = JSON.parse(saved);
                  // Rehydrate Date objects
                  return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
              } catch (e) {
                  console.error("Failed to load chat history", e);
              }
          }
      }
      return [];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Set initial message if provided (e.g. from Buy/Sell buttons)
  useEffect(() => {
    if (initialMessage) {
        setInput(initialMessage);
    }
  }, [initialMessage]);

  // Auto-Save to LocalStorage
  useEffect(() => {
      localStorage.setItem('market_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]); // Scroll on new message or loading state

  const clearHistory = () => {
      if (window.confirm("Are you sure you want to clear the entire chat history?")) {
          setMessages([]);
          localStorage.removeItem('market_chat_history');
      }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Limit history context to last 20 messages to prevent token overflow
      const historyContext = messages.slice(-20).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const { text, sources } = await sendMarketChatMessage(historyContext, userMsg.text);

      let chartData = undefined;
      let displayText = text;

      // --- Robust JSON Extraction Strategy ---
      
      // 1. Try extracting from standard Markdown code blocks
      const codeBlockRegex = /```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/i;
      let match = text.match(codeBlockRegex);
      let jsonString = match ? match[1] : null;

      // 2. Fallback: Try extracting a raw JSON array structure from the text
      // We look for [ followed by { and eventually ending with } and ]
      if (!jsonString) {
          const rawArrayRegex = /(\[\s*\{[\s\S]*?\}\s*\])/g;
          const allMatches = [...text.matchAll(rawArrayRegex)];
          // Usually the chart data is at the end of the response
          if (allMatches.length > 0) {
              jsonString = allMatches[allMatches.length - 1][0];
              match = [jsonString, jsonString] as RegExpMatchArray; // Mock match structure for replacement
          }
      }

      if (jsonString) {
        try {
            // Attempt to parse
            const parsed = JSON.parse(jsonString);
            
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Normalize Data Structure: Map various common keys to 'date' and 'value'
                const normalizedData = parsed.map((item: any) => ({
                    date: item.date || item.time || item.day || item.datetime,
                    value: Number(item.value || item.price || item.close || item.adj_close || item.amount)
                })).filter(item => item.date && !isNaN(item.value));

                if (normalizedData.length > 1) { // Need at least 2 points for a line
                    chartData = normalizedData;
                    // Remove the JSON text from the display message to keep UI clean
                    displayText = text.replace(match![0], '').trim();
                }
            }
        } catch (e) {
            console.warn("Detected JSON-like structure but failed to parse:", e);
        }
      }

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: displayText,
        chartData,
        sources, // Store sources separately
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'model',
          text: "Sorry, I encountered an error connecting to the market service.",
          timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700 bg-gray-800 shadow-md flex justify-between items-center">
        <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-green-400">
            <TrendingUp className="text-green-400" /> Market Assistant
            </h2>
            <p className="text-xs text-gray-400">Auto-saves conversation • Real-time data</p>
        </div>
        {messages.length > 0 && (
            <button 
                onClick={clearHistory}
                className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-gray-700 transition-colors"
                title="Clear Chat History"
            >
                <Trash2 size={18} />
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
            <TrendingUp size={48} className="opacity-20" />
            <div className="text-center">
                <p>Try asking:</p>
                <p className="font-medium text-gray-400">"TCS ka price kya chal raha hai?"</p>
                <p className="font-medium text-gray-400">"Reliance ka analysis batao"</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[95%] md:max-w-[85%] rounded-2xl p-5 shadow-lg ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-none'}`}>
              <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
              
              {/* Sources Display */}
              {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 font-bold uppercase mb-2 flex items-center gap-1">
                          <LinkIcon size={12} /> Data Sources
                      </p>
                      <div className="flex flex-wrap gap-2">
                          {msg.sources.map((source, idx) => (
                              <a 
                                key={idx} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-blue-400 text-xs px-3 py-1.5 rounded-full border border-gray-700 transition-colors"
                              >
                                  <ExternalLink size={10} />
                                  <span className="truncate max-w-[150px]">{source.title}</span>
                              </a>
                          ))}
                      </div>
                  </div>
              )}

              {msg.chartData && (
                <div className="mt-6 bg-gray-900 rounded-xl p-4 border border-gray-700/80 shadow-inner">
                  <div className="flex items-center gap-2 mb-4 text-xs font-bold text-green-400 uppercase tracking-wider">
                    <ChartIcon size={14} /> Performance Chart
                  </div>
                  {/* Increased Height to h-96 (approx 384px) for better visibility */}
                  <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={msg.chartData}>
                        <defs>
                          <linearGradient id={`gradient-${msg.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            stroke="#9CA3AF" 
                            fontSize={11} 
                            tickFormatter={(val) => {
                                // Try to format simple date if possible
                                try { return val.substring(5); } catch(e) { return val; }
                            }}
                            minTickGap={30}
                            tickMargin={10}
                        />
                        <YAxis stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} width={40} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#10B981', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                          itemStyle={{ color: '#10B981', fontWeight: 'bold' }}
                          labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                          cursor={{ stroke: '#10B981', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#10B981" 
                            strokeWidth={3} 
                            activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                            fill={`url(#gradient-${msg.id})`} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
                <div className="text-[10px] text-gray-500 mt-2 ml-2 self-end mb-4">
                    {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                </div>
            )}
          </div>
        ))}
        {loading && (
            <div className="flex justify-start">
                <div className="bg-gray-800 p-4 rounded-2xl rounded-bl-none border border-gray-700 flex items-center gap-3">
                    <Loader2 className="animate-spin text-green-400" size={20} />
                    <span className="text-gray-400 text-sm animate-pulse">Analyzing market data...</span>
                </div>
            </div>
        )}
      </div>

      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2 relative">
          <input 
            className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 transition-colors pr-24 text-sm md:text-base"
            placeholder="Ask about stocks... (Type or Speak)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <div className="absolute right-2 top-1.5 bottom-1.5 flex gap-1">
            <button 
                onClick={toggleVoiceInput}
                className={`px-3 rounded-lg transition-colors flex items-center justify-center ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                title="Voice Input"
            >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button 
                onClick={handleSend}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center text-white"
            >
                <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
