import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Send, Volume2, VolumeX, User, Bot, Loader2, CheckCircle2 } from 'lucide-react';
import { generateSpeech, getAIResponse } from '../services/aiService';
import { cn } from '../utils';

interface InterviewRoomProps {
  jobDescription: string;
  questions: string[];
  onComplete: (history: { role: "user" | "model"; text: string }[]) => void;
}

export const InterviewRoom: React.FC<InterviewRoomProps> = ({ jobDescription, questions, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [history, setHistory] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentQuestion = questions[currentQuestionIndex];

  useEffect(() => {
    // Initial greeting and first question
    const startInterview = async () => {
      const greeting = `Hello! I'm your interviewer today. I've reviewed the job description for this role. Let's get started. First question: ${currentQuestion}`;
      setHistory([{ role: 'model', text: greeting }]);
      speak(greeting);
    };
    startInterview();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const speak = async (text: string) => {
    setIsSpeaking(true);
    const url = await generateSpeech(text);
    if (url) {
      setAudioUrl(url);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    }
  };

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setUserAnswer(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setUserAnswer('');
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const handleAnswerSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userAnswer.trim() || isProcessing) return;

    if (isRecording) {
      recognitionRef.current?.stop();
    }

    const answer = userAnswer;
    setUserAnswer('');
    setIsProcessing(true);

    const newHistory = [...history, { role: 'user' as const, text: answer }];
    setHistory(newHistory);

    if (currentQuestionIndex < questions.length - 1) {
      const nextQuestion = questions[currentQuestionIndex + 1];
      const aiResponse = await getAIResponse(jobDescription, newHistory, answer, currentQuestion);
      const fullResponse = `${aiResponse} Moving on, ${nextQuestion}`;
      
      setHistory(prev => [...prev, { role: 'model', text: fullResponse }]);
      setCurrentQuestionIndex(prev => prev + 1);
      await speak(fullResponse);
    } else {
      const aiResponse = await getAIResponse(jobDescription, newHistory, answer, currentQuestion);
      const closing = `${aiResponse} That concludes our interview today. Thank you for your time. I'll now generate your feedback report.`;
      setHistory(prev => [...prev, { role: 'model', text: closing }]);
      await speak(closing);
      setTimeout(() => onComplete([...newHistory, { role: 'model', text: closing }]), 3000);
    }
    
    setIsProcessing(false);
  };

  return (
    <div className="max-w-4xl mx-auto h-[80vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-black/5 overflow-hidden">
      {/* Header */}
      <div className="px-8 py-4 bg-gray-50 border-bottom border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="font-medium text-gray-700">Live Interview Session</span>
        </div>
        <div className="text-sm text-gray-500 font-mono">
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth"
      >
        <AnimatePresence mode="popLayout">
          {history.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex gap-4 max-w-[80%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                msg.role === 'user' ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
              )}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-tr-none" 
                  : "bg-gray-100 text-gray-800 rounded-tl-none"
              )}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isProcessing && (
          <div className="flex gap-4 max-w-[80%] mr-auto">
            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
              <Bot size={20} />
            </div>
            <div className="p-4 bg-gray-100 rounded-2xl rounded-tl-none flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-gray-400" />
              <span className="text-sm text-gray-500 italic">Interviewer is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Audio Element */}
      <audio 
        ref={audioRef} 
        onEnded={() => setIsSpeaking(false)}
        className="hidden"
      />

      {/* Input Area */}
      <div className="p-8 bg-gray-50 border-t border-gray-100">
        <form onSubmit={handleAnswerSubmit} className="flex gap-4">
          <button
            type="button"
            onClick={toggleRecording}
            className={cn(
              "p-4 rounded-2xl transition-all flex items-center justify-center shadow-lg",
              isRecording 
                ? "bg-red-500 text-white animate-pulse shadow-red-100" 
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-gray-100"
            )}
            title={isRecording ? "Stop Recording" : "Start Voice Input"}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder={isRecording ? "Listening..." : "Type your answer here..."}
            className="flex-1 p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!userAnswer.trim() || isProcessing}
            className="px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-2xl transition-all flex items-center justify-center shadow-lg shadow-indigo-100"
          >
            <Send size={20} />
          </button>
        </form>
        <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Volume2 size={14} />
            <span>AI Voice Enabled</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 size={14} />
            <span>Real-time Feedback</span>
          </div>
        </div>
      </div>
    </div>
  );
};
