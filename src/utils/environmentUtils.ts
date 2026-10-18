/**
 * Environment detection utility for AI Studio and external deployments.
 * 
 * Rules:
 * - If running in AI Studio Preview (aistudio.google.com, run.app, ais-dev-, ais-pre-),
 *   use Server Proxy (/api/ai/...) in server.ts to bypass iframe sandbox restrictions.
 * - If running on external hosting (Vercel, Netlify, Custom Domain),
 *   direct client SDK (@google/genai) can be used for maximum speed.
 */

export function isAiStudioEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname.toLowerCase();

  // AI Studio preview domains
  if (
    hostname.includes('aistudio.google.com') ||
    hostname.includes('.run.app') ||
    hostname.startsWith('ais-dev-') ||
    hostname.startsWith('ais-pre-') ||
    hostname.includes('googleusercontent.com')
  ) {
    return true;
  }

  // Check if embedded in iframe from AI Studio
  try {
    if (window.self !== window.top) {
      return true;
    }
  } catch (e) {
    // Cross-origin iframe security error means we are inside a restricted sandbox
    return true;
  }

  return false;
}

export function shouldUseDirectClientCalls(): boolean {
  // If in AI Studio preview or local dev with backend server running,
  // we route through server proxy for robust secret handling and bypassing iframe limits.
  // Direct client calls are only preferred in standalone client-only hosting (e.g. Vercel static export).
  if (typeof window === 'undefined') return false;

  const isAiStudio = isAiStudioEnvironment();
  if (isAiStudio) {
    return false; // MUST use server proxy
  }

  // Check if user explicitly configured client-direct mode in localStorage
  const forceDirect = localStorage.getItem('force_direct_client_ai');
  if (forceDirect === 'true') {
    return true;
  }

  // Default to false if server is accessible, or true on pure static hosts like vercel.app
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.endsWith('.vercel.app') || hostname.endsWith('.netlify.app') || hostname.endsWith('.github.io')) {
    return true;
  }

  return false;
}
