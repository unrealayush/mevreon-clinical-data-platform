import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Sparkles,
  ShieldCheck,
  BrainCircuit,
  FileText,
  Eye,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '../utils/cn';

const agents = [
  {
    id: 'INGESTION',
    name: 'Data Ingestion',
    icon: Database,
    color: 'blue',
    description: 'Extracts and structures raw medical data from documents'
  },
  {
    id: 'CLEANING',
    name: 'Data Cleaning',
    icon: Sparkles,
    color: 'purple',
    description: 'Standardizes and validates medical terminology'
  },
  {
    id: 'VALIDATION',
    name: 'Clinical Validation',
    icon: ShieldCheck,
    color: 'amber',
    description: 'Performs safety checks and clinical validation'
  },
  {
    id: 'FEATURE',
    name: 'Feature Synthesis',
    icon: BrainCircuit,
    color: 'emerald',
    description: 'Creates longitudinal patient narrative'
  }
];

const AgentTabs = ({ runId, caseId, onViewArtifact }) => {
  const [activeTab, setActiveTab] = useState('INGESTION');
  const [artifactData, setArtifactData] = useState({});
  const [loading, setLoading] = useState({});

  const loadArtifact = async (stage) => {
    if (artifactData[stage]) return;

    setLoading(prev => ({ ...prev, [stage]: true }));
    try {
      const data = await onViewArtifact(stage);
      setArtifactData(prev => ({ ...prev, [stage]: data }));
    } catch (error) {
      console.error(`Failed to load ${stage} artifact:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [stage]: false }));
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const downloadJson = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderJsonViewer = (data, stage) => {
    if (!data) return null;

    const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    return (
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-300">
              {stage} Output - {runId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(jsonString)}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition-colors"
              title="Copy to clipboard"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => downloadJson(data, `${stage.toLowerCase()}_output.json`)}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition-colors"
              title="Download JSON"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
        <div className="max-h-96 overflow-auto custom-scrollbar">
          <SyntaxHighlighter
            language="json"
            style={oneDark}
            customStyle={{
              margin: 0,
              background: 'transparent',
              fontSize: '12px',
              lineHeight: '1.5'
            }}
            showLineNumbers={true}
            wrapLines={true}
          >
            {jsonString}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  const renderArtifactContent = (stage) => {
    const data = artifactData[stage];
    const isLoading = loading[stage];

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-slate-500 text-sm">Loading {stage} output...</p>
          </div>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
          <Info size={32} className="text-slate-600" />
          <p className="text-slate-500">Click "Load Output" to view {stage} results</p>
        </div>
      );
    }

    return renderJsonViewer(data, stage);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Eye size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-200">Agent Outputs</h3>
            <p className="text-sm text-slate-500 font-mono">{caseId} • {runId}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex overflow-x-auto">
          {agents.map((agent) => {
            const Icon = agent.icon;
            const isActive = activeTab === agent.id;

            return (
              <button
                key={agent.id}
                onClick={() => setActiveTab(agent.id)}
                className={cn(
                  "flex items-center gap-3 px-6 py-4 border-b-2 transition-all whitespace-nowrap min-w-0 flex-1",
                  isActive
                    ? `border-${agent.color}-500 text-${agent.color}-400`
                    : "border-transparent text-slate-500 hover:text-slate-400"
                )}
              >
                <Icon size={18} />
                <div className="text-left min-w-0">
                  <div className="font-medium text-sm">{agent.name}</div>
                  <div className="text-xs opacity-70 truncate">{agent.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Agent Info */}
            {(() => {
              const agent = agents.find(a => a.id === activeTab);
              const Icon = agent.icon;

              return (
                <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <div className={cn(
                    `h-12 w-12 bg-${agent.color}-500/20 border border-${agent.color}-500/30 rounded-xl flex items-center justify-center`
                  )}>
                    <Icon size={24} className={`text-${agent.color}-400`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-200 mb-1">{agent.name}</h4>
                    <p className="text-sm text-slate-500 mb-3">{agent.description}</p>
                    <button
                      onClick={() => loadArtifact(activeTab)}
                      disabled={loading[activeTab]}
                      className={cn(
                        "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2",
                        loading[activeTab]
                          ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                          : `bg-${agent.color}-600 hover:bg-${agent.color}-500 text-white`
                      )}
                    >
                      {loading[activeTab] ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                          Loading...
                        </>
                      ) : (
                        <>
                          <Eye size={14} />
                          Load Output
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Artifact Content */}
            {renderArtifactContent(activeTab)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AgentTabs;
