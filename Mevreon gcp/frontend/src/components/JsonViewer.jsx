import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Copy,
  Search,
  ChevronRight,
  ChevronDown,
  Braces,
  Hash,
  Type,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '../utils/cn';

const JsonViewer = ({ data, title, filename, className }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPaths, setExpandedPaths] = useState(new Set(['root']));
  const [copied, setCopied] = useState(false);

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${title.toLowerCase().replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderJsonTree = (obj, path = 'root', level = 0) => {
    if (typeof obj !== 'object' || obj === null) {
      const value = String(obj);
      const isMatch = searchTerm && value.toLowerCase().includes(searchTerm.toLowerCase());

      return (
        <div className={cn(
          "flex items-center gap-2 py-1 px-2 rounded text-sm",
          isMatch && "bg-yellow-500/20 border border-yellow-500/30"
        )}>
          <span className="text-slate-500 font-mono text-xs">{typeof obj}:</span>
          <span className={cn(
            "font-mono",
            typeof obj === 'string' && "text-emerald-400",
            typeof obj === 'number' && "text-blue-400",
            typeof obj === 'boolean' && "text-purple-400",
            obj === null && "text-slate-500 italic"
          )}>
            {obj === null ? 'null' : JSON.stringify(obj)}
          </span>
        </div>
      );
    }

    const isArray = Array.isArray(obj);
    const isExpanded = expandedPaths.has(path);
    const keys = Object.keys(obj);
    const filteredKeys = searchTerm
      ? keys.filter(key => key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          JSON.stringify(obj[key]).toLowerCase().includes(searchTerm.toLowerCase()))
      : keys;

    return (
      <div className="select-none">
        <div
          className={cn(
            "flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-slate-800/50 transition-colors",
            level === 0 && "bg-slate-800/30"
          )}
          onClick={() => {
            const newExpanded = new Set(expandedPaths);
            if (isExpanded) {
              newExpanded.delete(path);
            } else {
              newExpanded.add(path);
            }
            setExpandedPaths(newExpanded);
          }}
        >
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          {isArray ? (
            <Braces size={14} className="text-orange-400" />
          ) : (
            <Hash size={14} className="text-blue-400" />
          )}
          <span className="text-slate-300 font-medium">
            {isArray ? `Array[${obj.length}]` : `Object{${keys.length}}`}
          </span>
          {path !== 'root' && (
            <span className="text-slate-500 text-xs">({path})</span>
          )}
        </div>

        {isExpanded && (
          <div className="ml-4 border-l border-slate-700 pl-4 mt-1">
            {filteredKeys.map((key, index) => {
              const value = obj[key];
              const keyPath = `${path}.${key}`;

              return (
                <div key={key} className="mb-1">
                  <div className="flex items-center gap-2 py-1">
                    <span className="text-indigo-400 font-mono text-sm font-medium">{key}:</span>
                    {renderJsonTree(value, keyPath, level + 1)}
                  </div>
                </div>
              );
            })}
            {searchTerm && filteredKeys.length === 0 && (
              <div className="text-slate-500 text-sm italic py-2">No matches found</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const getStats = () => {
    try {
      const parsed = typeof data === 'object' ? data : JSON.parse(data);
      const stats = {
        keys: 0,
        arrays: 0,
        objects: 0,
        strings: 0,
        numbers: 0,
        booleans: 0,
        nulls: 0
      };

      const countTypes = (obj) => {
        if (typeof obj === 'object' && obj !== null) {
          if (Array.isArray(obj)) {
            stats.arrays++;
            obj.forEach(countTypes);
          } else {
            stats.objects++;
            Object.keys(obj).forEach(key => {
              stats.keys++;
              countTypes(obj[key]);
            });
          }
        } else {
          if (typeof obj === 'string') stats.strings++;
          else if (typeof obj === 'number') stats.numbers++;
          else if (typeof obj === 'boolean') stats.booleans++;
          else if (obj === null) stats.nulls++;
        }
      };

      countTypes(parsed);
      return stats;
    } catch {
      return null;
    }
  };

  const stats = getStats();

  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden", className)}>
      {/* Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-200">{title}</h3>
            <p className="text-sm text-slate-500 font-mono">{filename}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-sm focus:border-indigo-500 focus:outline-none w-48"
            />
          </div>

          {/* Copy Button */}
          <button
            onClick={copyToClipboard}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-colors relative"
            title="Copy to clipboard"
          >
            <Copy size={16} />
            {copied && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
              >
                Copied!
              </motion.div>
            )}
          </button>

          {/* Download Button */}
          <button
            onClick={downloadJson}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
            title="Download JSON"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800">
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Hash size={12} />
              <span>{stats.keys} keys</span>
            </div>
            <div className="flex items-center gap-1">
              <Braces size={12} />
              <span>{stats.objects} objects, {stats.arrays} arrays</span>
            </div>
            <div className="flex items-center gap-1">
              <Type size={12} />
              <span>{stats.strings} strings, {stats.numbers} numbers</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle size={12} />
              <span>{stats.booleans} booleans, {stats.nulls} nulls</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-h-96 overflow-auto custom-scrollbar">
        <div className="p-6">
          {searchTerm ? (
            renderJsonTree(typeof data === 'object' ? data : JSON.parse(data))
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default JsonViewer;
