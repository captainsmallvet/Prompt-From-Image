import { CentralAIModel } from './firebaseModelService';

/**
 * 1. Future-Proof Model Passthrough & Sanitization Policy:
 * - Keep original 100% if matching standard future patterns (/^gemini-[a-z0-9.-]+$/i, imagen-*, veo-*).
 * - Maps only permanently retired/deprecated models (1.5, 2.0 series) to current stable models to prevent 404s.
 */
export function resolveModelName(requestedModel: string): string {
  if (!requestedModel || typeof requestedModel !== 'string') {
    return 'gemini-3.5-flash';
  }

  const trimmed = requestedModel.trim();
  const lower = trimmed.toLowerCase();

  // Known permanently retired models mapping (Deprecation guard)
  const retiredMappings: Record<string, string> = {
    'gemini-1.5-flash': 'gemini-3.5-flash',
    'gemini-1.5-flash-latest': 'gemini-3.5-flash',
    'gemini-1.5-flash-8b': 'gemini-3.1-flash-lite',
    'gemini-1.5-pro': 'gemini-3.1-pro-preview',
    'gemini-1.5-pro-latest': 'gemini-3.1-pro-preview',
    'gemini-2.0-flash': 'gemini-3.5-flash',
    'gemini-2.0-flash-exp': 'gemini-3.5-flash',
    'gemini-2.0-flash-thinking-exp': 'gemini-3-flash-preview',
    'gemini-2.0-flash-thinking': 'gemini-3-flash-preview',
    'gemini-2.0-pro-exp': 'gemini-3.1-pro-preview',
    'gemini-2.0-pro': 'gemini-3.1-pro-preview',
    'gemini-pro': 'gemini-flash-latest',
    'gemini-1.0-pro': 'gemini-flash-latest',
  };

  if (retiredMappings[lower]) {
    return retiredMappings[lower];
  }

  // Future-Proof Pass-Through:
  // If model matches standard gemini, imagen, or veo naming conventions (including gemini-3.9, 4.0, 4.5, 5.0...),
  // preserve the original name 100% without tampering.
  if (
    /^gemini-[a-z0-9.-]+$/i.test(trimmed) ||
    /^imagen-[a-z0-9.-]+$/i.test(trimmed) ||
    /^veo-[a-z0-9.-]+$/i.test(trimmed)
  ) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Extracts numeric version from model string for comparison.
 * e.g., 'gemini-3.8-flash' -> 3.8, 'gemini-3.1-pro-preview' -> 3.1, 'gemini-4-argon' -> 4
 */
function extractModelVersion(modelName: string): number {
  const match = modelName.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Determines model sub-family keywords (lite, pro, flash, image, etc.)
 */
function getModelFamily(modelName: string): 'lite' | 'pro' | 'flash' | 'image' | 'general' {
  const lower = modelName.toLowerCase();
  if (lower.includes('image') || lower.includes('imagen')) return 'image';
  if (lower.includes('lite')) return 'lite';
  if (lower.includes('pro')) return 'pro';
  if (lower.includes('flash')) return 'flash';
  return 'general';
}

/**
 * 3. Smart Cascade Fallback Array Builder:
 * Creates an intelligent cascade order:
 * 1) Requested model (future-proof)
 * 2) Same family models sorted newer to older (from Central AI Models Registry first)
 * 3) Workhorse stable model (gemini-3.6-flash / gemini-3.5-flash / registry Level 1 default)
 * 4) High-speed model (gemini-3.8-flash)
 * 5) Token-saving / broad quota model (gemini-3.5-flash-lite / gemini-3.1-flash-lite / gemini-flash-lite-latest)
 */
export function buildModelCascade(
  requestedModel: string,
  centralModels: CentralAIModel[] = [],
  category: 'text' | 'image' = 'text'
): string[] {
  const target = resolveModelName(requestedModel);
  const modelsToTry: string[] = [target];

  if (category === 'text') {
    const family = getModelFamily(target);
    const textRegistry = centralModels.filter(m => m.category === 'text' && m.isActive);

    // Extract all models in same family from real-time registry and known list
    const sameFamilyFromRegistry = textRegistry
      .filter(m => getModelFamily(m.value) === family && m.value !== target)
      .sort((a, b) => {
        const verB = extractModelVersion(b.value);
        const verA = extractModelVersion(a.value);
        if (verB !== verA) return verB - verA; // Descending version
        return (a.order || 99) - (b.order || 99);
      })
      .map(m => m.value);

    // Baseline fallbacks in family
    const familyFallbacksMap: Record<string, string[]> = {
      flash: [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3-flash-preview',
        'gemini-flash-latest',
        'gemini-2.5-flash'
      ],
      lite: [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-2.5-flash-lite'
      ],
      pro: [
        'gemini-3.1-pro-preview',
        'gemini-3-pro-preview',
        'gemini-2.5-pro',
        'gemini-pro-latest'
      ],
      general: [
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest'
      ]
    };

    const staticFamilyFallbacks = familyFallbacksMap[family] || familyFallbacksMap.flash;

    // Step 2: Same family models (Registry first, then known)
    modelsToTry.push(...sameFamilyFromRegistry);
    modelsToTry.push(...staticFamilyFallbacks);

    // Step 3: Workhorse stable model (Level 1 default or gemini-3.5-flash/3.6-flash)
    const level1Model = textRegistry.find(m => m.isDefaultLevel1 || m.defaultLevel1);
    if (level1Model && level1Model.value) {
      modelsToTry.push(level1Model.value);
    }
    modelsToTry.push('gemini-3.5-flash');
    modelsToTry.push('gemini-flash-latest');

    // Step 4: High-speed model
    modelsToTry.push('gemini-3.8-flash');
    modelsToTry.push('gemini-3-flash-preview');

    // Step 5: Token-saving / broad quota model (Lite series)
    modelsToTry.push('gemini-3.1-flash-lite');
    modelsToTry.push('gemini-flash-lite-latest');
    modelsToTry.push('gemini-2.5-flash-lite');

  } else {
    // Image category cascade
    const imageRegistry = centralModels.filter(m => m.category === 'image' && m.isActive);

    const otherRegistryImages = imageRegistry
      .filter(m => m.value !== target)
      .sort((a, b) => (a.order || 99) - (b.order || 99))
      .map(m => m.value);

    modelsToTry.push(...otherRegistryImages);
    modelsToTry.push('gemini-2.5-flash-image');
    modelsToTry.push('gemini-3-pro-image-preview');
    modelsToTry.push('gemini-3.1-flash-image-preview');
    modelsToTry.push('imagen-4.0-generate-001');
    modelsToTry.push('gemini-flash-image-latest');
    modelsToTry.push('gemini-pro-image-latest');
  }

  // Deduplicate preserving insertion order
  return modelsToTry.filter((model, idx, arr) => arr.indexOf(model) === idx && Boolean(model));
}
