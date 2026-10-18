export interface ExecutionAttempt {
  model: string;
  success: boolean;
  error?: string;
  latencyMs: number;
}

export interface ExecutionLog {
  id: string;
  timestamp: number;
  task: 'concept' | 'prompt' | 'image' | 'test_key';
  requestedModel: string;
  actualModel: string;
  keySource: 'client_header' | 'local_storage' | 'server_env' | 'direct_client';
  latencyMs: number;
  status: 'success' | 'fallback_success' | 'failed';
  attempts: ExecutionAttempt[];
  error?: string;
  meta?: Record<string, any>;
}

type LogListener = (logs: ExecutionLog[]) => void;

class ExecutionTrackerService {
  private logs: ExecutionLog[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 50;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('gemini_ai_execution_logs');
        if (stored) {
          this.logs = JSON.parse(stored);
        }
      }
    } catch (e) {
      this.logs = [];
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('gemini_ai_execution_logs', JSON.stringify(this.logs.slice(0, this.maxLogs)));
      }
    } catch (e) {
      // Storage might be full or disabled
    }
  }

  public addLog(entry: Omit<ExecutionLog, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): ExecutionLog {
    const fullLog: ExecutionLog = {
      id: entry.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || Date.now(),
      task: entry.task,
      requestedModel: entry.requestedModel,
      actualModel: entry.actualModel,
      keySource: entry.keySource,
      latencyMs: entry.latencyMs,
      status: entry.status,
      attempts: entry.attempts || [],
      error: entry.error,
      meta: entry.meta
    };

    this.logs.unshift(fullLog);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.saveToStorage();
    this.notify();
    return fullLog;
  }

  public getLogs(): ExecutionLog[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.saveToStorage();
    this.notify();
  }

  public getLastLog(): ExecutionLog | null {
    return this.logs.length > 0 ? this.logs[0] : null;
  }

  public getLastStatus(): 'idle' | 'success' | 'fallback' | 'failed' {
    const last = this.getLastLog();
    if (!last) return 'idle';
    if (last.status === 'failed') return 'failed';
    if (last.status === 'fallback_success') return 'fallback';
    return 'success';
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = [...this.logs];
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (e) {
        console.error("Execution log listener error:", e);
      }
    });
  }
}

export const executionTracker = new ExecutionTrackerService();
