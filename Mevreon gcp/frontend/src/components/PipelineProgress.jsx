import React from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  Sparkles,
  ShieldCheck,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Clock,
  PlayCircle,
  Target,
  LineChart,
  Shield,
  Gauge
} from 'lucide-react';
import { cn } from '../utils/cn';

const stages = [
  { id: 'ingestion', name: 'Ingestion', icon: Database, color: 'blue' },
  { id: 'cleaning', name: 'Cleaning', icon: Sparkles, color: 'cyan' },
  { id: 'validation', name: 'Validation', icon: ShieldCheck, color: 'emerald' },
  { id: 'feature', name: 'Feature Synthesis', icon: BrainCircuit, color: 'indigo' },
  { id: 'compass', name: 'COMPASS', icon: Target, color: 'emerald' },
  { id: 'pinnacle', name: 'PINNACLE', icon: LineChart, color: 'sky' },
  { id: 'madrigal', name: 'Madrigal', icon: Shield, color: 'rose' },
  { id: 'judge', name: 'Narrative Judge', icon: Gauge, color: 'amber' }
];

const PipelineProgress = ({ caseData, theme }) => {
  const t = {
    bg: theme === 'dark' ? 'bg-slate-900' : 'bg-white',
    border: theme === 'dark' ? 'border-slate-800' : 'border-gray-200',
    text: theme === 'dark' ? 'text-slate-200' : 'text-gray-800',
    textMuted: theme === 'dark' ? 'text-slate-500' : 'text-gray-500',
    bgTertiary: theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100',
  };

  const getStageStatus = (stageId) => {
    const output = caseData.agentOutputs[stageId];
    if (output && output.length > 0) {
      // Simple check, could be enhanced with status from backend
      return 'completed';
    }
    // This is a simplified logic. A real implementation would need more state.
    const completedStages = Object.keys(caseData.agentOutputs);
    const currentStageIndex = stages.findIndex(s => s.id === completedStages[completedStages.length - 1]);
    const thisStageIndex = stages.findIndex(s => s.id === stageId);

    if (thisStageIndex === currentStageIndex + 1) return 'running';
    
    return 'pending';
  };

  const getStatusIcon = (stageStatus, Icon) => {
    switch (stageStatus) {
      case 'completed':
        return <CheckCircle2 size={18} className="text-emerald-500" />;
      case 'running':
        return <Loader2 size={18} className="text-indigo-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle size={18} className="text-rose-500" />;
      default:
        return <Icon size={18} className={t.textMuted} />;
    }
  };

  const completedCount = Object.keys(caseData.agentOutputs).length;
  const progress = (completedCount / stages.length) * 100;

  return (
    <div className={`p-6 rounded-2xl border ${t.bg} ${t.border}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`font-bold text-lg ${t.text}`}>Pipeline Progress</h3>
        <span className={`text-sm font-medium ${t.textMuted}`}>{completedCount} / {stages.length} Stages Complete</span>
      </div>

      <div className="w-full bg-slate-800 rounded-full h-2.5 mb-6">
        <motion.div
          className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
      </div>

      <div className="space-y-3">
        {stages.map((stage, index) => {
          const stageStatus = getStageStatus(stage.id);
          
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-4 p-3 rounded-lg ${t.bgTertiary}`}
            >
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center transition-all",
                stageStatus === 'completed' && "bg-emerald-500/10",
                stageStatus === 'running' && "bg-indigo-500/10",
                stageStatus === 'pending' && (theme === 'dark' ? "bg-slate-700/50" : "bg-gray-200"),
              )}>
                {getStatusIcon(stageStatus, stage.icon)}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className={`font-medium text-sm ${t.text}`}>{stage.name}</h4>
              </div>

              <span className={cn(
                "text-xs px-2 py-1 rounded-full font-semibold",
                stageStatus === 'completed' && "bg-emerald-500/10 text-emerald-400",
                stageStatus === 'running' && "bg-indigo-500/10 text-indigo-400",
                stageStatus === 'pending' && (theme === 'dark' ? "text-slate-500" : "text-gray-500"),
              )}>
                {stageStatus}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default PipelineProgress;
