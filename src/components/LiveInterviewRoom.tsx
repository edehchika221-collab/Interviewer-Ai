import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, PhoneOff, Volume2, Loader2, Sparkles, User, Bot } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { cn } from '../utils';

interface LiveInterviewRoomProps {
  jobDescription: string;
  onComplete: (history: { role: "user" | "model"; text: string }[]) => void;
}

export const LiveInterviewRoom: React.FC<LiveInterviewRoomProps> = ({ jobDescription, onComplete }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initInterview = async () => {
      try {
        // 1. Request Microphone Permission First
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        // 2. Initialize AudioContext
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.gain.value = volume;
        gainNodeRef.current.connect(audioContextRef.current.destination);
        
        // 3. Connect to Live API
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
        
        const session = await ai.live.connect({
          model: "gemini-2.5-flash-native-audio-preview-09-2025",
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
            },
            inputAudioTranscription: {}, // Enable user transcription
            systemInstruction: `You are a professional, high-stakes interviewer. 
            Job Description: ${jobDescription}
            
            Conduct a realistic, conversational interview. 
            - Start by introducing yourself and asking the first question.
            - Listen to the candidate's answers and provide natural follow-ups.
            - Be challenging but professional.
            - If the candidate asks to end the interview, or after about 5-7 minutes, wrap up.
            - Keep your responses concise as this is a real-time voice conversation.`,
          },
          callbacks: {
            onopen: () => {
              setIsConnected(true);
              setIsConnecting(false);
              startMicStreaming();
            },
            onmessage: async (message: LiveServerMessage) => {
              if (message.serverContent?.modelTurn) {
                const parts = message.serverContent.modelTurn.parts;
                for (const part of parts) {
                  if (part.inlineData) {
                    playAudioChunk(part.inlineData.data);
                  }
                  if (part.text) {
                    setTranscript(prev => {
                      const last = prev[prev.length - 1];
                      if (last?.role === 'model') {
                        return [...prev.slice(0, -1), { role: 'model', text: last.text + part.text! }];
                      }
                      return [...prev, { role: 'model', text: part.text! }];
                    });
                  }
                }
              }

              const serverContent = message.serverContent as any;
              if (serverContent?.userTurn) {
                const parts = serverContent.userTurn.parts;
                for (const part of parts) {
                  if (part.text) {
                    setTranscript(prev => {
                      const last = prev[prev.length - 1];
                      if (last?.role === 'user') {
                        return [...prev.slice(0, -1), { role: 'user', text: last.text + part.text! }];
                      }
                      return [...prev, { role: 'user', text: part.text! }];
                    });
                  }
                }
              }
              
              if (message.serverContent?.interrupted) {
                setIsInterrupted(true);
                stopAllAudio();
              }
            },
            onclose: () => {
              handleEndInterview();
            },
            onerror: (err) => {
              console.error("Live API Error:", err);
              setError("The AI connection was lost. Please check your internet and try again.");
              setIsConnecting(false);
            }
          }
        });

        sessionRef.current = session;
      } catch (err: any) {
        console.error("Initialization error:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError("Microphone access was denied. To continue with the voice interview, please allow microphone access in your browser settings and click retry.");
        } else {
          setError("Failed to initialize the interview. Please ensure your microphone is connected and try again.");
        }
        setIsConnecting(false);
      }
    };

    initInterview();

    return () => {
      handleEndInterview();
    };
  }, []);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const startMicStreaming = async () => {
    try {
      if (!audioContextRef.current || !streamRef.current) return;

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      
      processor.onaudioprocess = (e) => {
        if (sessionRef.current && isConnected) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          
          const volume = inputData.reduce((a, b) => a + Math.abs(b), 0) / inputData.length;
          setIsUserSpeaking(volume > 0.01);

          const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          sessionRef.current.sendRealtimeInput({
            media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      };
    } catch (err: any) {
      console.error("Mic streaming error:", err);
      setError("An error occurred while streaming your voice. Please try again.");
    }
  };

  const playAudioChunk = async (base64Data: string) => {
    if (!audioContextRef.current) return;
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcmData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x7FFF;
    }
    
    const audioBuffer = audioContextRef.current.createBuffer(1, floatData.length, 16000);
    audioBuffer.getChannelData(0).set(floatData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    
    if (gainNodeRef.current) {
      source.connect(gainNodeRef.current);
    } else {
      source.connect(audioContextRef.current.destination);
    }
    
    const now = audioContextRef.current.currentTime;
    let startTime = nextStartTimeRef.current;
    
    // If we are starting fresh or fell behind, add a small 100ms lookahead buffer
    if (startTime < now) {
      startTime = now + 0.1;
    }
    
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
    activeSourcesRef.current.push(source);

    setIsAISpeaking(true);
    source.onended = () => {
      // Remove from active sources
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
      
      // Only set isAISpeaking to false if this was the last scheduled chunk
      if (audioContextRef.current && audioContextRef.current.currentTime >= nextStartTimeRef.current - 0.05) {
        setIsAISpeaking(false);
      }
    };
  };

  const stopAllAudio = () => {
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Source might have already stopped
      }
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsAISpeaking(false);
  };

  const handleEndInterview = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    // On complete with current transcript
    onComplete(transcript);
  };

  return (
    <div className="max-w-4xl mx-auto h-[80vh] flex flex-col bg-gray-900 rounded-3xl shadow-2xl overflow-hidden relative border border-white/10">
      {/* Immersive Reactive Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Dynamic Atmospheric Gradient */}
        <motion.div 
          animate={{
            background: isUserSpeaking 
              ? "radial-gradient(circle at 20% 20%, rgba(79, 70, 229, 0.35) 0%, rgba(79, 70, 229, 0.05) 50%, transparent 100%)"
              : isAISpeaking
              ? "radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.35) 0%, rgba(16, 185, 129, 0.05) 50%, transparent 100%)"
              : "radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 80%)",
            scale: isUserSpeaking || isAISpeaking ? 1.1 : 1,
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        />

        {/* Secondary Reactive Accents */}
        <motion.div 
          animate={{
            opacity: isUserSpeaking ? 0.4 : 0,
            scale: isUserSpeaking ? [1, 1.2, 1] : 1,
          }}
          transition={{ duration: 0.8, repeat: isUserSpeaking ? Infinity : 0 }}
          className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_0%_0%,rgba(99,102,241,0.2)_0%,transparent_50%)]"
        />

        <motion.div 
          animate={{
            opacity: isAISpeaking ? 0.4 : 0,
            scale: isAISpeaking ? [1, 1.2, 1] : 1,
          }}
          transition={{ duration: 0.8, repeat: isAISpeaking ? Infinity : 0 }}
          className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.2)_0%,transparent_50%)]"
        />

        {/* Floating Particles/Orbs */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -120, 0],
                x: [0, Math.random() * 60 - 30, 0],
                opacity: isUserSpeaking || isAISpeaking ? [0.3, 0.6, 0.3] : [0.1, 0.3, 0.1],
                scale: isUserSpeaking || isAISpeaking ? [1, 1.5, 1] : 1,
              }}
              transition={{
                duration: 8 + i * 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className={cn(
                "absolute w-1.5 h-1.5 rounded-full blur-[2px] transition-colors duration-1000",
                isUserSpeaking ? "bg-indigo-400" : isAISpeaking ? "bg-emerald-400" : "bg-white/20"
              )}
              style={{
                left: `${(100 / 8) * i}%`,
                top: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-8 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-3 h-3 rounded-full",
            isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
          )} />
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            Live Voice Interview
          </h2>
        </div>
        <div className="px-4 py-1.5 bg-white/5 rounded-full text-xs font-mono text-white/50 border border-white/10">
          {isConnected ? "ENCRYPTED CONNECTION" : "CONNECTING..."}
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">
        <AnimatePresence mode="wait">
          {error ? (
            // ... (error UI remains same)
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-6 max-w-md"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <MicOff className="text-red-500" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-medium text-white">Microphone Error</h3>
                <p className="text-white/40 text-sm">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/10"
              >
                Retry
              </button>
            </motion.div>
          ) : isConnecting ? (
            // ... (connecting UI remains same)
            <motion.div 
              key="connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              <div className="relative">
                <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-medium text-white">Initializing AI Interviewer</h3>
                <p className="text-white/40 text-sm">Setting up secure voice channel...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="active"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full h-full flex flex-col items-center justify-between py-4"
            >
              {/* Visualizer Section */}
              <div className="flex flex-col items-center gap-8">
                <div className="relative flex items-center justify-center gap-24">
                  {/* User Node */}
                  <div className="relative flex flex-col items-center gap-4">
                    <motion.div 
                      animate={{ 
                        scale: isUserSpeaking ? [1, 1.4, 1] : 1,
                        opacity: isUserSpeaking ? [0.2, 0.5, 0.2] : 0.1
                      }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className={cn(
                        "absolute w-32 h-32 rounded-full blur-2xl transition-colors duration-500",
                        isUserSpeaking ? "bg-indigo-500" : "bg-white/5"
                      )}
                    />
                    <div className={cn(
                      "relative w-20 h-20 rounded-full flex items-center justify-center border transition-all duration-500 shadow-2xl backdrop-blur-md",
                      isUserSpeaking 
                        ? "bg-indigo-600 border-indigo-400 text-white scale-110" 
                        : "bg-white/5 border-white/10 text-white/20"
                    )}>
                      <User size={28} />
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium tracking-widest uppercase transition-colors duration-500",
                      isUserSpeaking ? "text-indigo-400" : "text-white/20"
                    )}>
                      You
                    </span>
                  </div>

                  {/* Connection Line */}
                  <div className="w-12 h-px bg-gradient-to-r from-indigo-500/20 via-white/10 to-emerald-500/20" />

                  {/* AI Node */}
                  <div className="relative flex flex-col items-center gap-4">
                    <motion.div 
                      animate={{ 
                        scale: isAISpeaking ? [1, 1.4, 1] : 1,
                        opacity: isAISpeaking ? [0.2, 0.5, 0.2] : 0.1
                      }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className={cn(
                        "absolute w-32 h-32 rounded-full blur-2xl transition-colors duration-500",
                        isAISpeaking ? "bg-emerald-500" : "bg-white/5"
                      )}
                    />
                    <div className={cn(
                      "relative w-20 h-20 rounded-full flex items-center justify-center border transition-all duration-500 shadow-2xl backdrop-blur-md",
                      isAISpeaking 
                        ? "bg-emerald-600 border-emerald-400 text-white scale-110" 
                        : "bg-white/5 border-white/10 text-white/20"
                    )}>
                      <motion.div
                        animate={isAISpeaking ? {
                          scale: [1, 1.15, 1],
                          opacity: [1, 0.7, 1]
                        } : {}}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        <Bot size={28} />
                      </motion.div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium tracking-widest uppercase transition-colors duration-500",
                      isAISpeaking ? "text-emerald-400" : "text-white/20"
                    )}>
                      Interviewer
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <div className="h-6">
                    <AnimatePresence mode="wait">
                      {isUserSpeaking ? (
                        <motion.h3 
                          key="user-speaking"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-lg font-semibold text-indigo-400"
                        >
                          Listening to you...
                        </motion.h3>
                      ) : isAISpeaking ? (
                        <motion.h3 
                          key="ai-speaking"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-lg font-semibold text-emerald-400"
                        >
                          Interviewer is speaking
                        </motion.h3>
                      ) : (
                        <motion.h3 
                          key="silent"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-lg font-semibold text-white/40"
                        >
                          Ready for your response
                        </motion.h3>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Compact Real-time Transcript */}
              <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden flex flex-col h-48">
                <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  <div className="w-1 h-1 bg-white/30 rounded-full" />
                  Live Transcript
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {transcript.length === 0 && (
                    <div className="h-full flex items-center justify-center text-white/10 text-xs italic">
                      Transcript will appear here as you speak...
                    </div>
                  )}
                  {transcript.map((entry, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-3"
                    >
                      <span className={cn(
                        "text-[10px] font-bold uppercase shrink-0 w-12 pt-0.5",
                        entry.role === 'user' ? "text-indigo-400" : "text-emerald-400"
                      )}>
                        {entry.role === 'user' ? 'YOU' : 'AI'}
                      </span>
                      <p className="text-xs text-white/70 leading-relaxed">
                        {entry.text}
                      </p>
                    </motion.div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="relative z-10 p-8 bg-black/20 border-t border-white/5 flex items-center justify-center gap-8">
        <button
          onClick={handleEndInterview}
          className="group flex flex-col items-center gap-3"
        >
          <div className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all shadow-xl shadow-red-500/20 group-hover:scale-110">
            <PhoneOff size={24} />
          </div>
          <span className="text-xs font-medium text-white/40 group-hover:text-white transition-colors">End Interview</span>
        </button>
        
        <div className="h-12 w-px bg-white/10" />
        
        <div className="flex flex-col items-center gap-4 min-w-[160px]">
          <div className="flex items-center gap-3 text-white/40">
            <Volume2 size={20} />
            <span className="text-xs font-medium uppercase tracking-wider">AI Volume</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:bg-white/20 transition-all"
          />
        </div>

        <div className="h-12 w-px bg-white/10" />

        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/40">
            <Mic size={24} />
          </div>
          <span className="text-xs font-medium text-white/40">Mic Active</span>
        </div>
      </div>
    </div>
  );
};
