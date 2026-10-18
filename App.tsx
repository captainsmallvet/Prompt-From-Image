import React, { useState, useEffect, useRef } from 'react';
import { ImageStyle, ModelType, AspectRatio, AppState, TextModelType } from './types';
import NotepadArea from './components/NotepadArea';
import FloatingMenu from './components/FloatingMenu';
import AILogModal from './components/AILogModal';
import * as geminiService from './services/geminiService';
import {
  subscribeCentralAIModels,
  getDefaultModelForLevel,
  getFallbackModels,
  APP_IMPORTANCE_LEVEL,
  CentralAIModel
} from './services/firebaseModelService';

const App: React.FC = () => {
  // --- API Key Management (Local & Session) ---
  const [inputKey, setInputKey] = useState<string>('');

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setInputKey(savedKey);
      (window as any).process = { env: { API_KEY: savedKey, GEMINI_API_KEY: savedKey } };
    } else {
      setInputKey('no API key');
    }
  }, []);

  const handleSendKey = () => {
    if (inputKey && inputKey !== 'no API key') {
      localStorage.setItem('gemini_api_key', inputKey);
      (window as any).process = { env: { API_KEY: inputKey, GEMINI_API_KEY: inputKey } };
      alert("บันทึก API Key เรียบร้อยแล้วครับ");
      window.location.reload(); 
    }
  };

  const fallbacks = getFallbackModels();
  const [textModelsList, setTextModelsList] = useState<CentralAIModel[]>(fallbacks.textModels);
  const [imageModelsList, setImageModelsList] = useState<CentralAIModel[]>(fallbacks.imageModels);

  const initialDefaultText = getDefaultModelForLevel(fallbacks.textModels, APP_IMPORTANCE_LEVEL)?.value || 'gemini-3.5-flash';
  const initialDefaultImage = getDefaultModelForLevel(fallbacks.imageModels, APP_IMPORTANCE_LEVEL)?.value || 'gemini-2.5-flash-image';

  const [state, setState] = useState<AppState>({
    referenceImage: null,
    imageStyle: ImageStyle.REFERENCE,
    additionDetails: '',
    imageConceptThai: '',
    enhancePromptEnglish: '',
    maxPromptLength: 800,
    selectedTextModel: initialDefaultText,
    selectedModel: initialDefaultImage,
    selectedAspectRatio: '16:9',
    generatedImage: null,
    isLoading: false,
    statusMessage: '',
  });

  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [modalDefaultTab, setModalDefaultTab] = useState<'logs' | 'key'>('logs');

  // Real-Time Subscription to Central Firestore ai_models collection via onSnapshot
  useEffect(() => {
    const unsub = subscribeCentralAIModels((fetched) => {
      if (fetched.textModels && fetched.textModels.length > 0) {
        setTextModelsList(fetched.textModels);
        const defaultTextModel = getDefaultModelForLevel(fetched.textModels, APP_IMPORTANCE_LEVEL);
        if (defaultTextModel) {
          setState(prev => {
            if (!prev.selectedTextModel || prev.selectedTextModel === 'gemini-3.5-flash') {
              return { ...prev, selectedTextModel: defaultTextModel.value };
            }
            return prev;
          });
        }
      }

      if (fetched.imageModels && fetched.imageModels.length > 0) {
        setImageModelsList(fetched.imageModels);
        const defaultImageModel = getDefaultModelForLevel(fetched.imageModels, APP_IMPORTANCE_LEVEL);
        if (defaultImageModel) {
          setState(prev => {
            if (!prev.selectedModel || prev.selectedModel === 'gemini-2.5-flash-image') {
              return { ...prev, selectedModel: defaultImageModel.value };
            }
            return prev;
          });
        }
      }
    });

    return () => unsub();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateState({ referenceImage: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  };

  const handleCreateThaiConcept = async () => {
    updateState({ isLoading: true, statusMessage: 'Analyzing image and details with Smart Cascade Fallback...' });
    try {
      const concept = await geminiService.generateConceptInThai(
        state.referenceImage,
        state.additionDetails,
        state.imageStyle,
        state.selectedTextModel,
        textModelsList
      );
      updateState({ imageConceptThai: concept });
    } catch (error: any) {
      console.error(error);
      alert('Error creating concept in Thai: ' + (error?.message || error));
    } finally {
      updateState({ isLoading: false, statusMessage: '' });
    }
  };

  const handleCreateEnhancedPrompt = async () => {
    if (!state.imageConceptThai) {
      alert('Please create or enter Thai concept first.');
      return;
    }
    updateState({ isLoading: true, statusMessage: 'Generating enhanced English prompt with Smart Cascade Fallback...' });
    try {
      const prompt = await geminiService.generateEnhancedPrompt(
        state.imageConceptThai,
        state.maxPromptLength,
        state.selectedTextModel,
        textModelsList
      );
      updateState({ enhancePromptEnglish: prompt });
    } catch (error: any) {
      console.error(error);
      alert('Error creating enhanced prompt: ' + (error?.message || error));
    } finally {
      updateState({ isLoading: false, statusMessage: '' });
    }
  };

  const handleCreateImage = async () => {
    if (!state.enhancePromptEnglish) {
      alert('Please create or enter English prompt first.');
      return;
    }

    updateState({ isLoading: true, statusMessage: `Generating high-quality image (${state.selectedModel})...` });
    try {
      const imgUrl = await geminiService.generateImage(
        state.enhancePromptEnglish,
        state.selectedModel,
        state.selectedAspectRatio,
        imageModelsList
      );
      updateState({ generatedImage: imgUrl });
    } catch (error: any) {
      console.error(error);
      alert('Error creating image: ' + (error?.message || error));
    } finally {
      updateState({ isLoading: false, statusMessage: '' });
    }
  };

  const handleDownloadImage = () => {
    if (!state.generatedImage) return;
    const link = document.createElement('a');
    link.href = state.generatedImage;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUseAsReference = () => {
    if (state.generatedImage) {
      updateState({ referenceImage: state.generatedImage });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-slate-50">
      <div className="w-full max-w-[1000px] flex flex-col gap-6 pb-24">
        {/* API Key Management Bar */}
        <div className="p-4 bg-gray-900 border border-emerald-500/30 rounded-2xl shadow-md">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Gemini API Key Control Panel
              </label>
              <button
                onClick={() => { setModalDefaultTab('logs'); setIsLogModalOpen(true); }}
                className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 font-semibold transition-colors"
              >
                <span>📊 ดูประวัติ & Fallback Logs</span>
              </button>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="กรอก Gemini API Key หรือใช้ค่าเริ่มต้นจากระบบ"
                className="w-full flex-1 bg-black border border-gray-700 rounded-xl px-3 py-2 text-sm font-mono text-emerald-300 outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={handleSendKey} className="flex-1 sm:flex-none bg-emerald-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 text-white transition-colors">SAVE</button>
                <button onClick={() => { navigator.clipboard.writeText(inputKey); alert("Copy แล้วครับ"); }} className="flex-1 sm:flex-none bg-blue-600 px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-blue-700 transition-colors">COPY</button>
                <button onClick={() => { localStorage.removeItem('gemini_api_key'); setInputKey(''); alert("ลบ Key แล้วครับ"); }} className="flex-1 sm:flex-none bg-rose-600 px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-rose-700 transition-colors">CLEAR</button>
                <button
                  onClick={() => { setModalDefaultTab('key'); setIsLogModalOpen(true); }}
                  className="flex-1 sm:flex-none bg-indigo-600 px-4 py-2 rounded-xl text-xs font-bold text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
                >
                  ⚡ TEST KEY
                </button>
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-indigo-700 text-center mb-2 uppercase tracking-wider">
          Prompt From Image
        </h1>
        <p className="text-center text-sm text-gray-500 -mt-4 mb-2">
          Dual-Layer Resilient Gemini AI Engine with Smart Cascade Fallback & Centralized Model Registry
        </p>

        {/* Text Reasoning Model Selection */}
        {textModelsList.length > 0 && (
          <div className="flex flex-col w-full">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-700 font-bold ml-1 text-lg">Text Reasoning Model</label>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono font-medium">
                Live Synced with Registry ({textModelsList.length} models)
              </span>
            </div>
            <select 
              className="w-full p-2.5 border-2 border-gray-300 rounded-xl outline-none focus:border-indigo-500 transition-colors bg-white font-medium text-gray-800"
              value={state.selectedTextModel}
              onChange={(e) => updateState({ selectedTextModel: e.target.value })}
            >
              {textModelsList.map(m => (
                <option key={m.id || m.value} value={m.value}>
                  {m.name} {m.isDefaultLevel1 ? '★ (Default Level 1)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 1. Reference Image */}
        <div className="flex flex-col w-full">
          <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">1. Reference Image (ภาพอ้างอิง)</label>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <button 
                onClick={handleOpenClick}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors shadow-sm"
              >
                OPEN
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            {state.referenceImage && (
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-2 max-w-md bg-white">
                <img 
                  src={state.referenceImage} 
                  alt="Reference Preview" 
                  className="w-full h-auto rounded max-h-60 object-contain mx-auto"
                />
                <button 
                  onClick={() => updateState({ referenceImage: null })}
                  className="absolute top-4 right-4 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. Style Image */}
        <div className="flex flex-col w-full">
          <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">2. Style Image (สไตล์ของภาพ)</label>
          <select 
            className="w-full p-2.5 border-2 border-gray-300 rounded-xl outline-none focus:border-indigo-500 transition-colors bg-white font-medium text-gray-800"
            value={state.imageStyle}
            onChange={(e) => updateState({ imageStyle: e.target.value as ImageStyle })}
          >
            {Object.values(ImageStyle).map((style) => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
        </div>

        {/* 3. Addition Details */}
        <div className="flex flex-col w-full">
          <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">3. Addition Details (ข้อมูลเพิ่มเติม)</label>
          <textarea 
            rows={4}
            className="w-full p-3 border-2 border-gray-300 rounded-xl outline-none focus:border-indigo-500 transition-colors resize-none bg-white text-gray-800"
            placeholder="ใส่รายละเอียดที่ต้องการเพิ่ม เช่น โทนสี อารมณ์ของภาพ องค์ประกอบเฉพาะ..."
            value={state.additionDetails}
            onChange={(e) => updateState({ additionDetails: e.target.value })}
          />
        </div>

        {/* 4. Action: Create Concept in Thai */}
        <button 
          onClick={handleCreateThaiConcept}
          disabled={state.isLoading}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
          {state.isLoading && state.statusMessage.includes('image and details') ? 'Analyzing...' : 'CREATE CONCEPT IN THAI'}
        </button>

        {/* 5. Image Concept in Thai */}
        <NotepadArea 
          label="5. Image Concept in Thai (คอนเซปต์ภาพภาษาไทย)"
          value={state.imageConceptThai}
          onChange={(val) => updateState({ imageConceptThai: val })}
          onCopy={() => copyToClipboard(state.imageConceptThai)}
          onClear={() => updateState({ imageConceptThai: '' })}
          placeholder="Concept จะปรากฏที่นี่หลังจากคลิกปุ่มสร้าง..."
          rows={6}
        />

        {/* 6. Action: Create Enhanced Prompt */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-gray-700 font-bold">Max Character:</span>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="100" 
                max="2000" 
                step="50"
                value={state.maxPromptLength}
                onChange={(e) => updateState({ maxPromptLength: parseInt(e.target.value) })}
                className="w-32 md:w-48 accent-indigo-600"
              />
              <span className="font-mono text-indigo-600 font-bold w-12 text-right">{state.maxPromptLength}</span>
            </div>
          </div>
          <button 
            onClick={handleCreateEnhancedPrompt}
            disabled={state.isLoading}
            className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {state.isLoading && state.statusMessage.includes('enhanced English') ? 'Generating...' : 'CREATE ENHANCED PROMPT'}
          </button>
        </div>

        {/* 6. Enhanced Prompt in English */}
        <NotepadArea 
          label="6. Enhanced Prompt in English (พรอมต์ภาษาอังกฤษแบบละเอียด)"
          value={state.enhancePromptEnglish}
          onChange={(val) => updateState({ enhancePromptEnglish: val })}
          onCopy={() => copyToClipboard(state.enhancePromptEnglish)}
          onClear={() => updateState({ enhancePromptEnglish: '' })}
          placeholder="Enhanced prompt จะปรากฏที่นี่หลังจากคลิกปุ่มสร้าง..."
          rows={6}
        />

        {/* 7. Model Selection and Create Image */}
        <div className="flex flex-col gap-4 mb-4">
          {imageModelsList.length > 0 && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-700 font-bold ml-1 text-lg">Model สร้างภาพ</label>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-mono font-medium">
                  Live Synced ({imageModelsList.length} models)
                </span>
              </div>
              <select 
                className="w-full p-2.5 border-2 border-gray-300 rounded-xl outline-none focus:border-indigo-500 transition-colors bg-white font-medium text-gray-800"
                value={state.selectedModel}
                onChange={(e) => updateState({ selectedModel: e.target.value })}
              >
                {imageModelsList.map(m => (
                  <option key={m.id || m.value} value={m.value}>
                    {m.name} {m.isDefaultLevel1 ? '★ (Default Level 1)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col">
            <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">Aspect Ratio</label>
            <select 
              className="w-full p-2.5 border-2 border-gray-300 rounded-xl outline-none focus:border-indigo-500 transition-colors bg-white font-medium text-gray-800"
              value={state.selectedAspectRatio}
              onChange={(e) => updateState({ selectedAspectRatio: e.target.value as AspectRatio })}
            >
              <option value="1:1">1:1 (Square)</option>
              <option value="3:4">3:4 (Portrait)</option>
              <option value="4:3">4:3 (Landscape)</option>
              <option value="9:16">9:16 (Tall)</option>
              <option value="16:9">16:9 (Wide)</option>
            </select>
          </div>

          <button 
            onClick={handleCreateImage}
            disabled={state.isLoading}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {state.isLoading && state.statusMessage.includes('image') ? 'Generating Image...' : 'CREATE IMAGE'}
          </button>

          {state.statusMessage && (
            <p className="text-center text-indigo-600 font-semibold animate-pulse">{state.statusMessage}</p>
          )}

          {state.generatedImage && (
            <div className="flex flex-col items-center mt-4 p-4 border-2 border-indigo-100 bg-white rounded-2xl shadow-xl">
              <img 
                src={state.generatedImage} 
                alt="Generated" 
                className="w-full rounded-lg shadow-sm mb-4"
              />
              <div className="flex gap-4 w-full">
                <button 
                  onClick={handleDownloadImage}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                >
                  Download
                </button>
                <button 
                  onClick={handleUseAsReference}
                  className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg transition-colors"
                >
                  Use as Reference
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Dynamic Short Model Floating Menu & Quick Switcher */}
      <FloatingMenu
        selectedTextModel={state.selectedTextModel}
        selectedImageModel={state.selectedModel}
        textModelsList={textModelsList}
        imageModelsList={imageModelsList}
        onSelectTextModel={(model) => updateState({ selectedTextModel: model })}
        onSelectImageModel={(model) => updateState({ selectedModel: model })}
        onOpenLogModal={() => { setModalDefaultTab('logs'); setIsLogModalOpen(true); }}
        onOpenKeyModal={() => { setModalDefaultTab('key'); setIsLogModalOpen(true); }}
      />

      {/* 7. AI Log & Execution Transparency Modal with API Key Manager */}
      <AILogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        defaultTab={modalDefaultTab}
        onKeyUpdated={(newKey) => setInputKey(newKey || 'no API key')}
      />
    </div>
  );
};

export default App;
