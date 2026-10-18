import React, { useState, useEffect } from 'react';
import { CentralAIModel } from '../services/firebaseModelService';
import { executionTracker, ExecutionLog } from '../services/executionTracker';

export interface ShortModelDisplay {
  version: string;
  family: string;
  modifier: string;
  line1: string;
  line2: string;
  line3?: string;
}

/**
 * 6. Dynamic Short Model Display Generator:
 * Extracts decimal versions (\d+\.\d+) or single integers (\d+) and keywords
 * (Flash, Pro, Lite, Ultra, Imagen, etc.) dynamically via Regular Expressions.
 * Zero hardcoded versions — automatically future-proof for gemini-3.9, 4.0, 4.5, 5.0...
 */
export function getShortModelDisplay(modelNameOrValue: string): ShortModelDisplay {
  if (!modelNameOrValue) {
    return {
      version: 'Auto',
      family: 'Gemini',
      modifier: '',
      line1: 'Gemini',
      line2: 'Auto',
    };
  }

  const clean = modelNameOrValue.replace(/\(\d+\)/g, '').trim();
  const lower = clean.toLowerCase();

  // Extract decimal version or single digit version
  const versionMatch = clean.match(/(\d+\.\d+|\d+)/);
  const version = versionMatch ? versionMatch[1] : (lower.includes('latest') ? 'Latest' : '');

  // Extract keywords
  let family = 'Flash';
  if (lower.includes('imagen')) family = 'Imagen';
  else if (lower.includes('veo')) family = 'Veo';
  else if (lower.includes('ultra')) family = 'Ultra';
  else if (lower.includes('pro')) family = 'Pro';
  else if (lower.includes('lite') && !lower.includes('flash')) family = 'Lite';
  else if (lower.includes('flash')) family = 'Flash';

  let modifier = '';
  if (lower.includes('lite') && family !== 'Lite') modifier = 'Lite';
  else if (lower.includes('image')) modifier = 'Image';
  else if (lower.includes('preview')) modifier = 'Preview';
  else if (lower.includes('high quality')) modifier = 'HQ';

  const line1 = version ? `${version} ${family}` : `Gemini ${family}`;
  const line2 = modifier ? modifier : (lower.includes('image') ? 'Image Gen' : 'Reasoning');
  const line3 = lower.includes('preview') && modifier !== 'Preview' ? 'Preview' : undefined;

  return {
    version,
    family,
    modifier,
    line1,
    line2,
    line3
  };
}

interface FloatingMenuProps {
  selectedTextModel: string;
  selectedImageModel: string;
  textModelsList: CentralAIModel[];
  imageModelsList: CentralAIModel[];
  onSelectTextModel: (model: string) => void;
  onSelectImageModel: (model: string) => void;
  onOpenLogModal: () => void;
  onOpenKeyModal: () => void;
}

export const FloatingMenu: React.FC<FloatingMenuProps> = ({
  selectedTextModel,
  selectedImageModel,
  textModelsList,
  imageModelsList,
  onSelectTextModel,
  onSelectImageModel,
  onOpenLogModal,
  onOpenKeyModal,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'fallback' | 'failed'>('idle');
  const [lastLog, setLastLog] = useState<ExecutionLog | null>(null);

  useEffect(() => {
    const unsub = executionTracker.subscribe((logs) => {
      if (logs.length > 0) {
        setLastLog(logs[0]);
        if (logs[0].status === 'failed') setStatus('failed');
        else if (logs[0].status === 'fallback_success') setStatus('fallback');
        else setStatus('success');
      } else {
        setStatus('idle');
        setLastLog(null);
      }
    });
    return unsub;
  }, []);

  const textDisplay = getShortModelDisplay(selectedTextModel);
  const imageDisplay = getShortModelDisplay(selectedImageModel);

  // Status indicator colors
  const statusStyles = {
    idle: {
      dot: 'bg-emerald-400',
      pulse: 'bg-emerald-400/30',
      text: 'พร้อมใช้งาน',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    success: {
      dot: 'bg-green-500',
      pulse: 'bg-green-500/40 animate-ping',
      text: 'Direct Target',
      badge: 'bg-green-50 text-green-700 border-green-200'
    },
    fallback: {
      dot: 'bg-amber-500',
      pulse: 'bg-amber-500/40 animate-ping',
      text: 'Cascade Fallback',
      badge: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    failed: {
      dot: 'bg-rose-500',
      pulse: 'bg-rose-500/40 animate-ping',
      text: 'ข้อผิดพลาด',
      badge: 'bg-rose-50 text-rose-700 border-rose-200'
    }
  };

  const currentStatus = statusStyles[status];

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end select-none">
      {/* Expanded Control Palette */}
      {isExpanded && (
        <div className="mb-3 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-indigo-100 p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${currentStatus.pulse}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${currentStatus.dot}`}></span>
              </span>
              <span className="font-bold text-gray-800 text-sm">Gemini Resilient Engine</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              title="ย่อเมนู"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Text Reasoning Model Switcher */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-gray-600">Text Reasoning Model</label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-medium">
                {textDisplay.line1}
              </span>
            </div>
            <select
              value={selectedTextModel}
              onChange={(e) => onSelectTextModel(e.target.value)}
              className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
            >
              {textModelsList.map((m) => (
                <option key={m.id || m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Image Model Switcher */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-gray-600">Image Generation Model</label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono font-medium">
                {imageDisplay.line1}
              </span>
            </div>
            <select
              value={selectedImageModel}
              onChange={(e) => onSelectImageModel(e.target.value)}
              className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium"
            >
              {imageModelsList.map((m) => (
                <option key={m.id || m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Info & Telemetry summary */}
          {lastLog && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-100 text-[11px] text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>คำขอล่าสุด:</span>
                <span className="font-semibold text-gray-800 uppercase">{lastLog.task}</span>
              </div>
              <div className="flex justify-between">
                <span>โมเดลที่ตอบ:</span>
                <span className="font-mono font-medium text-indigo-600 truncate max-w-[140px]">{lastLog.actualModel}</span>
              </div>
              <div className="flex justify-between">
                <span>ความเร็ว (Latency):</span>
                <span className="font-mono text-gray-700">{lastLog.latencyMs} ms</span>
              </div>
              <div className="flex justify-between">
                <span>แหล่งของ Key:</span>
                <span className="text-gray-700">{lastLog.keySource}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
            <button
              onClick={() => {
                onOpenLogModal();
                setIsExpanded(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              AI Logs ({executionTracker.getLogs().length})
            </button>
            <button
              onClick={() => {
                onOpenKeyModal();
                setIsExpanded(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              จัดการ Key
            </button>
          </div>
        </div>
      )}

      {/* Main Floating Trigger Badge */}
      <div className="flex items-center gap-2">
        {/* Quick Log button */}
        <button
          onClick={onOpenLogModal}
          className="h-11 px-3 bg-white/90 hover:bg-white backdrop-blur-md border border-gray-200 rounded-xl shadow-lg flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-indigo-600 transition-all hover:scale-105"
          title="ดูประวัติการเรียกใช้ AI และ Fallback Telemetry"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${currentStatus.pulse}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${currentStatus.dot}`}></span>
          </span>
          <span className="font-mono font-semibold">{lastLog ? `${lastLog.latencyMs}ms` : 'Ready'}</span>
        </button>

        {/* Dynamic Model Pill Switcher */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="group relative flex items-center bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl shadow-xl hover:shadow-2xl p-2.5 transition-all duration-300 hover:scale-[1.03]"
          title="คลิกเพื่อสลับโมเดลหรือปรับแต่งระบบ AI"
        >
          {/* Dynamic 2-3 Line Model Display */}
          <div className="flex items-center gap-2.5 px-1.5">
            <div className="flex flex-col text-left leading-tight">
              <span className="text-xs font-black tracking-wide flex items-center gap-1">
                {textDisplay.line1}
                <span className="text-[10px] bg-white/20 text-white px-1 py-0.2 rounded font-normal">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-indigo-100 font-medium">
                {textDisplay.line2} {textDisplay.line3 ? `• ${textDisplay.line3}` : ''}
              </span>
            </div>

            <div className="h-6 w-[1px] bg-white/20"></div>

            {/* Indicator Icon */}
            <svg
              className={`w-4 h-4 text-white/80 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
};

export default FloatingMenu;
