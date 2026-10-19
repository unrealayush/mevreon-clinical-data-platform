import React from 'react';
import { motion } from 'framer-motion';
import {
  User,
  FileText,
  AlertTriangle,
  Pill,
  Activity,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../utils/cn';

const CaseCard = ({ caseData, onClick, isSelected, theme }) => {
  const { id, data, lastModified, files } = caseData;
  const t = {
    bg: theme === 'dark' ? 'bg-slate-900' : 'bg-white',
    border: theme === 'dark' ? 'border-slate-800' : 'border-gray-200',
    text: theme === 'dark' ? 'text-slate-200' : 'text-gray-800',
    textMuted: theme === 'dark' ? 'text-slate-500' : 'text-gray-500',
    bgHover: theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100',
    activeBorder: theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600',
    activeShadow: theme === 'dark' ? 'shadow-indigo-500/20' : 'shadow-indigo-500/10',
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'HIGH':
      case 'VERY HIGH':
        return 'rose';
      case 'MODERATE':
        return 'amber';
      case 'LOW':
        return 'emerald';
      default:
        return 'slate';
    }
  };

  const getRiskIcon = (risk) => {
    switch (risk) {
      case 'HIGH':
      case 'VERY HIGH':
        return <TrendingUp size={16} className="text-rose-400" />;
      case 'MODERATE':
        return <Minus size={16} className="text-amber-400" />;
      case 'LOW':
        return <TrendingDown size={16} className="text-emerald-400" />;
      default:
        return <Minus size={16} className="text-slate-400" />;
    }
  };

  const riskColor = getRiskColor(data?.readmission_risk);

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={cn(
        "border rounded-2xl p-6 cursor-pointer transition-all group",
        t.bg,
        isSelected
          ? `${t.activeBorder} shadow-lg ${t.activeShadow}`
          : `${t.border} hover:border-slate-700`
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'}`}>
            <User size={24} className={t.textMuted} />
          </div>
          <div>
            <h3 className={`text-lg font-bold mb-1 ${t.text}`}>{id}</h3>
            <div className={`flex items-center gap-2 text-sm ${t.textMuted}`}>
              <Clock size={14} />
              <span>{format(new Date(lastModified), 'MMM d, HH:mm')}</span>
            </div>
          </div>
        </div>

        {data?.readmission_risk && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
            `bg-${riskColor}-500/10 border border-${riskColor}-500/20`
          )}>
            {getRiskIcon(data.readmission_risk)}
            <span className={`text-${riskColor}-400`}>
              {data.readmission_risk} Risk
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100'} p-3 rounded-lg`}>
          <div className={`flex items-center gap-2 mb-1 text-xs uppercase ${t.textMuted}`}>
            <FileText size={14} />
            <span>Encounters</span>
          </div>
          <div className={`text-xl font-bold ${t.text}`}>{Object.keys(files || {}).length}</div>
        </div>

        <div className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100'} p-3 rounded-lg`}>
          <div className={`flex items-center gap-2 mb-1 text-xs uppercase ${t.textMuted}`}>
            <AlertTriangle size={14} />
            <span>Problems</span>
          </div>
          <div className={`text-xl font-bold ${t.text}`}>{data?.problem_count || 0}</div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="space-y-3 text-sm">
        {data?.active_medications > 0 && (
          <div className={`flex items-center gap-2 ${t.textMuted}`}>
            <Pill size={14} className="text-blue-400" />
            <span>
              {data.active_medications} active medications
            </span>
          </div>
        )}

        {data?.narrative_quality && (
          <div className={`flex items-center gap-2 ${t.textMuted}`}>
            <CheckCircle size={14} className="text-emerald-400" />
            <span>Narrative Quality: 
              <span className={cn(
                "font-medium ml-1",
                data.narrative_quality === 'EXCELLENT' && "text-emerald-400",
                data.narrative_quality === 'GOOD' && "text-blue-400",
              )}>
                {data.narrative_quality}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Action Indicator */}
      <div className="flex items-center justify-end mt-5 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 text-sm text-indigo-400 font-medium">
          <span>View Details</span>
          <ArrowRight size={16} />
        </div>
      </div>
    </motion.div>
  );
};

export default CaseCard;

