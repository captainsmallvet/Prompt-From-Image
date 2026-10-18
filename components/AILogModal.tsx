import React, { useState, useEffect } from 'react';
import { executionTracker, ExecutionLog } from '../services/executionTracker';
import { testGeminiApiKey, getClientApiKey } from '../services/geminiClientService';

interface AILogModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'logs' | 'key';
  onKeyUpdated?: (newKey: string) => void;
}

export const AILogModal: React.FC<AILogModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'logs',
  onKeyUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'key'>(defaultTab);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testState, setTestState] = useState<{
    isLoading: boolean;
    result: { success: boolean; latencyMs: number; message: string } | null;
  }>({ isLoading: false, result: null });

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setApiKeyInput(getClientApiKey());
      setTestState({ isLoading: false, result: null });
    }
  }, [isOpen, defaultTab]);

  useEffect(() => {
    const unsub = executionTracker.subscribe((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!apiKeyInput.trim()) {
      setTestState({
        isLoading: false,
        result: { success: false, latencyMs: 0, message: 'กรุณากรอก Gemini API Key ก่อนทำการทดสอบ' }
      });
      return;
    }

    setTestState({ isLoading: true, result: null });
    const res = await testGeminiApiKey(apiKeyInput.trim());
    setTestState({ isLoading: false, result: res });
  };

  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim();
    if (trimmed) {
      localStorage.setItem('gemini_api_key', trimmed);
      (window as any).process = { env: { API_KEY: trimmed, GEMINI_API_KEY: trimmed } };
      if (onKeyUpdated) onKeyUpdated(trimmed);
      alert('บันทึก API Key ใน LocalStorage ส่วนตัวของคุณเรียบร้อยแล้ว');
    } else {
      handleClearKey();
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKeyInput('');
    if ((window as any).process?.env) {
      delete (window as any).process.env.API_KEY;
      delete (window as any).process.env.GEMINI_API_KEY;
    }
    if (onKeyUpdated) onKeyUpdated('');
    alert('ลบ API Key ส่วนตัวแล้ว ระบบจะใช้ Key เริ่มต้นของเซิร์ฟเวอร์');
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">AI Engine Control & Transparency Center</h2>
              <p className="text-xs text-gray-500">บันทึกประวัติการเรียกใช้, Fallback Telemetry, และการตั้งค่า Gemini Key</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Execution Logs ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('key')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'key'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Gemini API Key Manager
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'logs' ? (
            <div>
              {logs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm font-medium">ยังไม่มีบันทึกประวัติการเรียกใช้ในเซสชันนี้</p>
                  <p className="text-xs text-gray-400 mt-1">เมื่อคุณกดสร้าง Concept, Prompt หรือ Generate Image ข้อมูลจะปรากฏที่นี่</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      รายการประวัติล่าสุด ({logs.length} รายการ)
                    </span>
                    <button
                      onClick={() => executionTracker.clearLogs()}
                      className="text-xs text-rose-500 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                    >
                      ล้างประวัติทั้งหมด
                    </button>
                  </div>

                  {logs.map((log) => {
                    const isFallback = log.status === 'fallback_success';
                    const isFailed = log.status === 'failed';

                    return (
                      <div
                        key={log.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isFailed
                            ? 'bg-rose-50/50 border-rose-200'
                            : isFallback
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-white border-gray-200 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {log.task}
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                isFailed
                                  ? 'bg-rose-100 text-rose-700'
                                  : isFallback
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {isFailed ? 'Failed' : isFallback ? 'Cascade Fallback' : 'Direct Success'}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500">
                              Key Source: <strong className="text-gray-700">{log.keySource}</strong>
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-800 font-mono font-medium">
                              {log.latencyMs} ms
                            </span>
                          </div>
                        </div>

                        {/* Model Comparison */}
                        <div className="mt-2 text-xs flex flex-wrap items-center gap-2 font-mono">
                          <span className="text-gray-500">Requested:</span>
                          <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                            {log.requestedModel}
                          </span>
                          <span className="text-gray-400">➔</span>
                          <span className="text-gray-500">Actual:</span>
                          <span className={`font-semibold px-2 py-0.5 rounded ${
                            isFallback ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {log.actualModel}
                          </span>
                        </div>

                        {/* Cascade Attempts Details */}
                        {log.attempts && log.attempts.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-gray-100">
                            <p className="text-[11px] font-semibold text-gray-500 mb-1">
                              ลำดับการลองโมเดล (Cascade Attempts - {log.attempts.length}):
                            </p>
                            <div className="space-y-1">
                              {log.attempts.map((att, idx) => (
                                <div
                                  key={idx}
                                  className="text-[11px] font-mono flex items-center justify-between p-1.5 rounded bg-white/70 border border-gray-100"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="w-4 text-center text-gray-400 font-bold">{idx + 1}.</span>
                                    <span className="font-medium text-gray-700 truncate">{att.model}</span>
                                    {att.error && (
                                      <span className="text-rose-600 text-[10px] truncate max-w-[200px]" title={att.error}>
                                        ({att.error})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-gray-500">{att.latencyMs}ms</span>
                                    <span className={att.success ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                      {att.success ? '✓ สำเร็จ' : '✕ ล้มเหลว'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {log.error && (
                          <div className="mt-2 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100">
                            <strong>Error:</strong> {log.error}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Gemini API Key Manager */
            <div className="space-y-6">
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 leading-relaxed">
                <strong className="block text-sm font-bold mb-1 text-indigo-950">ความปลอดภัยของ API Key:</strong>
                คีย์ของคุณจะถูกจัดเก็บเฉพาะใน <strong>LocalStorage บนเบราว์เซอร์ของคุณ</strong> โดยตรง
                สามารถใช้สำหรับการพัฒนาและทดสอบส่วนบุคคลได้ทันที หรือหากไม่กรอก ระบบจะใช้ Server-Side Proxy Key อัตโนมัติ
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Gemini API Key ส่วนตัว
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all pr-24"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-200"
                  >
                    {showKey ? 'ซ่อน' : 'แสดง'}
                  </button>
                </div>
              </div>

              {/* Key Test Feedback Banner */}
              {testState.result && (
                <div
                  className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
                    testState.result.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <span className="text-lg">
                    {testState.result.success ? '✓' : '✕'}
                  </span>
                  <div>
                    <strong className="block font-semibold">
                      {testState.result.success ? 'การทดสอบสำเร็จ' : 'การทดสอบล้มเหลว'}
                    </strong>
                    <p className="text-xs mt-0.5">{testState.result.message}</p>
                    {testState.result.latencyMs > 0 && (
                      <p className="text-[11px] font-mono mt-1 opacity-80">
                        Response Latency: {testState.result.latencyMs} ms
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleTestKey}
                  disabled={testState.isLoading}
                  className="px-5 py-2.5 bg-gray-800 hover:bg-black text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {testState.isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      กำลังทดสอบ...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      ทดสอบการเชื่อมต่อ Key
                    </>
                  )}
                </button>

                <button
                  onClick={handleSaveKey}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
                >
                  บันทึก Key
                </button>

                <button
                  onClick={handleClearKey}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all"
                >
                  ล้าง Key ส่วนตัว
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>Engine: Dual-Layer Resilient Gemini Architecture</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

export default AILogModal;
