import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, Activity } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

export const LiveConsultant: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  
  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startSession = async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return alert("No API Key");

    const ai = new GoogleGenAI({ apiKey });
    
    // Init Audio Contexts
    inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Get Mic Stream
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Connect to Live API
    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            systemInstruction: "You are an expert financial consultant. Speak professionally, concisely, and confidently about stock market topics. Do not hallucinate data. If unsure, advise checking the dashboard.",
        },
        callbacks: {
            onopen: () => {
                setConnected(true);
                // Setup Input Processing
                if (!inputContextRef.current) return;
                const source = inputContextRef.current.createMediaStreamSource(stream);
                const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
                processorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmBlob = createBlob(inputData);
                    sessionPromise.then(session => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                };
                
                source.connect(processor);
                processor.connect(inputContextRef.current.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
                const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData && outputContextRef.current) {
                    setIsTalking(true);
                    const ctx = outputContextRef.current;
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                    
                    const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                    const source = ctx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(ctx.destination);
                    
                    source.addEventListener('ended', () => {
                        sourcesRef.current.delete(source);
                        if (sourcesRef.current.size === 0) setIsTalking(false);
                    });
                    
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += buffer.duration;
                    sourcesRef.current.add(source);
                }
            },
            onclose: () => {
                setConnected(false);
                cleanup();
            },
            onerror: (e) => {
                console.error(e);
                setConnected(false);
                cleanup();
            }
        }
    });
  };

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current?.disconnect();
    inputContextRef.current?.close();
    outputContextRef.current?.close();
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setConnected(false);
  }, []);

  useEffect(() => {
      return () => cleanup();
  }, [cleanup]);

  // Audio Utils
  function createBlob(data: Float32Array) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    const uint8 = new Uint8Array(int16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    const b64 = btoa(binary);
    return {
        data: b64,
        mimeType: 'audio/pcm;rate=16000'
    };
  }

  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) {
     const dataInt16 = new Int16Array(data.buffer);
     const frameCount = dataInt16.length / numChannels;
     const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
     for (let c = 0; c < numChannels; c++) {
         const channelData = buffer.getChannelData(c);
         for (let i = 0; i < frameCount; i++) {
             channelData[i] = dataInt16[i * numChannels + c] / 32768.0;
         }
     }
     return buffer;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white p-8">
      <div className={`w-48 h-48 rounded-full flex items-center justify-center mb-8 transition-all duration-500 ${connected ? 'bg-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.3)]' : 'bg-gray-800'}`}>
        {connected ? (
            isTalking ? <Activity size={64} className="text-red-500 animate-pulse" /> : <Volume2 size={64} className="text-red-500" />
        ) : (
            <MicOff size={64} className="text-gray-500" />
        )}
      </div>

      <h2 className="text-3xl font-bold mb-4">{connected ? "Live Consultant Active" : "Start Live Consultation"}</h2>
      <p className="text-gray-400 mb-8 max-w-md text-center">
        Talk directly to our AI financial expert. Ask about market updates, stock definitions, or investment strategies in real-time.
      </p>

      {!connected ? (
          <button onClick={startSession} className="bg-red-600 hover:bg-red-700 text-white text-xl font-bold py-4 px-12 rounded-full flex items-center gap-3 transition-transform hover:scale-105">
              <Mic /> Connect Live
          </button>
      ) : (
          <button onClick={cleanup} className="bg-gray-700 hover:bg-gray-600 text-white text-lg font-bold py-3 px-8 rounded-full transition-colors">
              Disconnect
          </button>
      )}
    </div>
  );
};