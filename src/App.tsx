import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { JobInput } from './components/JobInput';
import { InterviewRoom } from './components/InterviewRoom';
import { LiveInterviewRoom } from './components/LiveInterviewRoom';
import { FeedbackReport } from './components/FeedbackReport';
import { generateInterviewQuestions, evaluateInterview } from './services/aiService';
import { Sparkles, ShieldCheck, Zap } from 'lucide-react';

type AppState = 'input' | 'interviewing' | 'live-interview' | 'feedback';

export default function App() {
  const [state, setState] = useState<AppState>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [history, setHistory] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [evaluation, setEvaluation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interviewMode, setInterviewMode] = useState<'chat' | 'voice'>('chat');

  const handleStartInterview = async (description: string, mode: 'chat' | 'voice') => {
    setIsLoading(true);
    setJobDescription(description);
    setInterviewMode(mode);
    
    if (mode === 'chat') {
      const qs = await generateInterviewQuestions(description);
      setQuestions(qs);
      setIsLoading(false);
      setState('interviewing');
    } else {
      setIsLoading(false);
      setState('live-interview');
    }
  };

  const handleInterviewComplete = async (finalHistory: { role: "user" | "model"; text: string }[]) => {
    setHistory(finalHistory);
    setState('feedback');
    setIsLoading(true);
    const report = await evaluateInterview(jobDescription, finalHistory);
    setEvaluation(report);
    setIsLoading(false);
  };

  const handleReset = () => {
    setState('input');
    setJobDescription('');
    setQuestions([]);
    setHistory([]);
    setEvaluation('');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Background Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-1/2 -right-24 w-64 h-64 bg-purple-100 rounded-full blur-3xl opacity-30" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-8 py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Sparkles size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">Interviewer AI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
          <a href="#" className="hover:text-indigo-600 transition-colors">How it works</a>
          <a href="#" className="hover:text-indigo-600 transition-colors">Pricing</a>
          <a href="#" className="hover:text-indigo-600 transition-colors">Resources</a>
          <button className="px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-md">
            Sign In
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 px-6 py-12 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {state === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center max-w-3xl mx-auto space-y-6">
                <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
                  Master your next interview with <span className="text-indigo-600">AI precision.</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Upload any job description and practice with our advanced AI interviewer. 
                  Get real-time voice feedback and a comprehensive performance report.
                </p>
                <div className="flex flex-wrap justify-center gap-6 pt-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <ShieldCheck className="text-emerald-500" size={18} />
                    Realistic Scenarios
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Zap className="text-amber-500" size={18} />
                    Instant Evaluation
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Sparkles className="text-indigo-500" size={18} />
                    Thinking Mode Enabled
                  </div>
                </div>
              </div>
              <JobInput 
                onStart={(desc) => handleStartInterview(desc, 'chat')} 
                onStartVoice={(desc) => handleStartInterview(desc, 'voice')}
                isLoading={isLoading} 
              />
            </motion.div>
          )}

          {state === 'interviewing' && (
            <motion.div
              key="interview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
            >
              <InterviewRoom 
                jobDescription={jobDescription} 
                questions={questions} 
                onComplete={handleInterviewComplete} 
              />
            </motion.div>
          )}

          {state === 'live-interview' && (
            <motion.div
              key="live-interview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
            >
              <LiveInterviewRoom 
                jobDescription={jobDescription} 
                onComplete={handleInterviewComplete} 
              />
            </motion.div>
          )}

          {state === 'feedback' && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-[60vh] flex flex-col items-center justify-center"
            >
              {isLoading ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <h3 className="text-xl font-semibold text-gray-900">Analyzing your performance...</h3>
                  <p className="text-gray-500">Our AI is reviewing your answers against the job requirements.</p>
                </div>
              ) : (
                <FeedbackReport evaluation={evaluation} onReset={handleReset} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-24 border-t border-gray-200 py-12 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white">
              <Sparkles size={18} />
            </div>
            <span className="font-bold text-gray-900">Interviewer AI</span>
          </div>
          <p className="text-sm text-gray-500">
            © 2026 Interviewer AI. Powered by Gemini 3.1 Pro. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm font-medium text-gray-500">
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
