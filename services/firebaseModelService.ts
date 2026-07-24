import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Centralized Firebase Configuration
const firebaseConfig = {
  projectId: "gen-lang-client-0014422363",
  appId: "1:978227936883:web:946402bf6886970bc77406",
  apiKey: "AIzaSyAJLNrYkuTt16qs034UlkEBJrMvlrNCnA4",
  authDomain: "gen-lang-client-0014422363.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-29f335c3-c8ac-451f-97d7-9c310736d1d9",
  storageBucket: "gen-lang-client-0014422363.firebasestorage.app",
  messagingSenderId: "978227936883",
  measurementId: ""
};

// Application Importance Level requirement
export const APP_IMPORTANCE_LEVEL = 1;

export interface CentralAIModel {
  id: string;
  value: string;
  name: string;
  category: 'text' | 'image' | 'tts' | 'video' | string;
  isActive: boolean;
  order: number;
  isDefaultLevel1?: boolean;
  isDefaultLevel2?: boolean;
  defaultLevel1?: boolean;
  defaultLevel2?: boolean;
  [key: string]: any;
}

// Initialize Firebase App & Firestore (Read-Only client for central database)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export function normalizeModelDoc(docId: string, data: any): CentralAIModel {
  const modelValue = data.value || data.modelId || data.id || docId;
  const modelName = data.name || data.label || data.displayName || data.title || modelValue;
  
  let category = (data.category || data.type || data.modelCategory || '').toLowerCase();
  if (!category) {
    if (modelValue.includes('image') || modelValue.includes('imagen')) {
      category = 'image';
    } else if (modelValue.includes('tts') || modelValue.includes('speech') || modelValue.includes('audio')) {
      category = 'tts';
    } else if (modelValue.includes('video') || modelValue.includes('veo')) {
      category = 'video';
    } else {
      category = 'text';
    }
  } else if (category.includes('text') || category.includes('reasoning')) {
    category = 'text';
  } else if (category.includes('image')) {
    category = 'image';
  }

  const isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
  const order = typeof data.order === 'number' ? data.order : (typeof data.sortOrder === 'number' ? data.sortOrder : 999);

  const isDefaultL1 = Boolean(
    data.isDefaultLevel1 ??
    data.defaultLevel1 ??
    data.defaultL1 ??
    data.isDefaultL1 ??
    data.level1Default ??
    (data.isDefault && (data.defaultLevel === 1 || data.level === 1 || !data.defaultLevel))
  );

  const isDefaultL2 = Boolean(
    data.isDefaultLevel2 ??
    data.defaultLevel2 ??
    data.defaultL2 ??
    data.isDefaultL2 ??
    data.level2Default ??
    (data.isDefault && (data.defaultLevel === 2 || data.level === 2))
  );

  return {
    ...data,
    id: docId,
    value: modelValue,
    name: modelName,
    category,
    isActive,
    order,
    isDefaultLevel1: isDefaultL1,
    isDefaultLevel2: isDefaultL2,
  };
}

export function getFallbackModels(): { textModels: CentralAIModel[]; imageModels: CentralAIModel[] } {
  const textModels: CentralAIModel[] = [
    { id: 'gemini-3.5-flash', value: 'gemini-3.5-flash', name: '(20)Gemini 3.5 Flash', category: 'text', isActive: true, order: 1, isDefaultLevel1: true },
    { id: 'gemini-3-flash-preview', value: 'gemini-3-flash-preview', name: '(20)Gemini 3 Flash Preview', category: 'text', isActive: true, order: 2 },
    { id: 'gemini-3.1-pro-preview', value: 'gemini-3.1-pro-preview', name: '(0)Gemini 3.1 Pro Preview', category: 'text', isActive: true, order: 3 },
    { id: 'gemini-3.1-flash-lite', value: 'gemini-3.1-flash-lite', name: '(500)Gemini 3.1 Flash Lite', category: 'text', isActive: true, order: 4 },
    { id: 'gemini-flash-latest', value: 'gemini-flash-latest', name: 'Gemini Flash Latest', category: 'text', isActive: true, order: 5 },
    { id: 'gemini-flash-lite-latest', value: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite Latest', category: 'text', isActive: true, order: 6 },
    { id: 'gemini-2.5-flash', value: 'gemini-2.5-flash', name: '(20)Gemini 2.5 Flash', category: 'text', isActive: true, order: 7 },
    { id: 'gemini-2.5-flash-lite', value: 'gemini-2.5-flash-lite', name: '(20)Gemini 2.5 Flash Lite', category: 'text', isActive: true, order: 8 },
    { id: 'gemini-2.5-pro', value: 'gemini-2.5-pro', name: '(0)Gemini 2.5 Pro', category: 'text', isActive: true, order: 9 },
    { id: 'gemini-pro-latest', value: 'gemini-pro-latest', name: 'Gemini Pro (Latest Stable)', category: 'text', isActive: true, order: 10 },
  ];

  const imageModels: CentralAIModel[] = [
    { id: 'gemini-2.5-flash-image', value: 'gemini-2.5-flash-image', name: 'gemini-2.5-flash-image (Default)', category: 'image', isActive: true, order: 1, isDefaultLevel1: true },
    { id: 'gemini-3-pro-image-preview', value: 'gemini-3-pro-image-preview', name: 'gemini-3-pro-image-preview', category: 'image', isActive: true, order: 2 },
    { id: 'imagen-4.0-generate-001', value: 'imagen-4.0-generate-001', name: 'imagen-4.0-generate-001', category: 'image', isActive: true, order: 3 },
    { id: 'gemini-flash-image-latest', value: 'gemini-flash-image-latest', name: 'Gemini Flash Image Latest', category: 'image', isActive: true, order: 4 },
    { id: 'gemini-pro-image-latest', value: 'gemini-pro-image-latest', name: 'Gemini Pro Image Latest', category: 'image', isActive: true, order: 5 },
    { id: 'gemini-3.1-flash-image-preview', value: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image (High Quality)', category: 'image', isActive: true, order: 6 },
  ];

  return { textModels, imageModels };
}

export function getDefaultModelForLevel(models: CentralAIModel[], level: 1 | 2 = APP_IMPORTANCE_LEVEL): CentralAIModel | null {
  if (!models || models.length === 0) return null;

  if (level === 1) {
    const l1 = models.find(m => m.isDefaultLevel1 || m.defaultLevel1 || m.isDefaultL1);
    if (l1) return l1;
  } else if (level === 2) {
    const l2 = models.find(m => m.isDefaultLevel2 || m.defaultLevel2 || m.isDefaultL2);
    if (l2) return l2;
  }

  const genericDefault = models.find(m => m.isDefault || m.default);
  if (genericDefault) return genericDefault;

  return models[0];
}

export async function fetchCentralAIModels(): Promise<{ textModels: CentralAIModel[]; imageModels: CentralAIModel[] }> {
  const fallbacks = getFallbackModels();
  try {
    const colRef = collection(db, "ai_models");
    const snapshot = await getDocs(colRef);
    const allModels: CentralAIModel[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const model = normalizeModelDoc(docSnap.id, data);
      if (model.isActive) {
        allModels.push(model);
      }
    });

    if (allModels.length === 0) {
      return fallbacks;
    }

    // Sort by order ascending
    allModels.sort((a, b) => a.order - b.order);

    const textModels = allModels.filter(m => m.category === 'text');
    const imageModels = allModels.filter(m => m.category === 'image');

    return {
      textModels: textModels.length > 0 ? textModels : fallbacks.textModels,
      imageModels: imageModels.length > 0 ? imageModels : fallbacks.imageModels,
    };
  } catch (error) {
    console.warn("Could not fetch central AI models from Firestore, utilizing fallback options:", error);
    return fallbacks;
  }
}
