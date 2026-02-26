import React from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Trophy, ArrowLeft, Download, Share2 } from 'lucide-react';

interface FeedbackReportProps {
  evaluation: string;
  onReset: () => void;
}

export const FeedbackReport: React.FC<FeedbackReportProps> = ({ evaluation, onReset }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto p-8 bg-white rounded-3xl shadow-2xl border border-black/5"
    >
      <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-2xl text-yellow-600">
            <Trophy size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Interview Performance Report</h2>
            <p className="text-gray-500">Comprehensive analysis of your session</p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors font-medium"
        >
          <ArrowLeft size={20} />
          Try Another Role
        </button>
      </div>

      <div className="prose prose-indigo max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-strong:text-gray-900 prose-ul:text-gray-600">
        <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
          <ReactMarkdown>{evaluation}</ReactMarkdown>
        </div>
      </div>

      <div className="mt-12 flex gap-4">
        <button className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
          <Download size={20} />
          Save Report as PDF
        </button>
        <button className="px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
          <Share2 size={20} />
          Share Results
        </button>
      </div>
    </motion.div>
  );
};
