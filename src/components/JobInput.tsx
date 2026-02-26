import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Briefcase, Send, Loader2, Mic } from 'lucide-react';

interface JobInputProps {
  onStart: (description: string) => void;
  onStartVoice: (description: string) => void;
  isLoading: boolean;
}

export const JobInput: React.FC<JobInputProps> = ({ onStart, onStartVoice, isLoading }) => {
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent, mode: 'chat' | 'voice') => {
    e.preventDefault();
    if (description.trim()) {
      if (mode === 'chat') onStart(description);
      else onStartVoice(description);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto p-8 bg-white rounded-3xl shadow-xl border border-black/5"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
          <Briefcase size={24} />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900">Prepare for your Interview</h2>
      </div>
      
      <p className="text-gray-600 mb-8">
        Paste the job description below. Choose between a structured chat interview or a real-time voice-only "human" experience.
      </p>

      <form className="space-y-6">
        <div className="relative">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste job description here (e.g., Senior Software Engineer at Google...)"
            className="w-full h-64 p-6 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-gray-800 placeholder:text-gray-400"
            required
          />
          <div className="absolute bottom-4 right-4 text-xs text-gray-400">
            {description.length} characters
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any, 'chat')}
            disabled={isLoading || !description.trim()}
            className="w-full py-4 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:border-gray-300 disabled:text-gray-400 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Send size={20} />
                Chat Interview
              </>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any, 'voice')}
            disabled={isLoading || !description.trim()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-2xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Mic size={20} />
                Voice Interview
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};
