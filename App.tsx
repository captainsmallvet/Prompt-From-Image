
// เพิ่ม useEffect เข้าไปในปีกกาครับ
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageStyle, ModelType, AspectRatio, AppState, TextModelType } from './types';
import NotepadArea from './components/NotepadArea';
import * as geminiService from './services/geminiService';

const App: React.FC = () => {
  // --- ระบบจัดการ API Key สำหรับใช้งานส่วนตัว ---
    const [inputKey, setInputKey] = useState<string>('');

      useEffect(() => {
          const savedKey = localStorage.getItem('gemini_api_key');
              if (savedKey) {
                    setInputKey(savedKey);
                          (window as any).process = { env: { API_KEY: savedKey } };
                              } else {
                                    setInputKey('no API key');
                                        }
                                          }, []);

                                            const handleSendKey = () => {
                                                if (inputKey && inputKey !== 'no API key') {
                                                      localStorage.setItem('gemini_api_key', inputKey);
                                                            alert("บันทึก API Key เรียบร้อยแล้วครับ");
                                                                  window.location.reload(); 
                                                                      }
                                                                        };
  const [state, setState] = useState<AppState>({
    referenceImage: null,
    imageStyle: ImageStyle.REFERENCE,
    additionDetails: '',
    imageConceptThai: '',
    enhancePromptEnglish: '',
    maxPromptLength: 800,
    selectedTextModel: TextModelType.GEMINI_3_FLASH_PREVIEW,
    selectedModel: ModelType.FLASH_IMAGE,
    selectedAspectRatio: '16:9',
    generatedImage: null,
    isLoading: false,
    statusMessage: '',
  });

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
    updateState({ isLoading: true, statusMessage: 'Analyzing image and details...' });
    try {
      const concept = await geminiService.generateConceptInThai(
        state.referenceImage,
        state.additionDetails,
        state.imageStyle,
        state.selectedTextModel
      );
      updateState({ imageConceptThai: concept });
    } catch (error) {
      console.error(error);
      alert('Error creating concept in Thai');
    } finally {
      updateState({ isLoading: false, statusMessage: '' });
    }
  };

  const handleCreateEnhancedPrompt = async () => {
    if (!state.imageConceptThai) {
      alert('Please create or enter Thai concept first.');
      return;
    }
    updateState({ isLoading: true, statusMessage: 'Generating enhanced English prompt...' });
    try {
      const prompt = await geminiService.generateEnhancedPrompt(
        state.imageConceptThai,
        state.maxPromptLength,
        state.selectedTextModel
      );
      updateState({ enhancePromptEnglish: prompt });
    } catch (error) {
      console.error(error);
      alert('Error creating enhanced prompt');
    } finally {
      updateState({ isLoading: false, statusMessage: '' });
    }
  };

  const handleCreateImage = async () => {
    if (!state.enhancePromptEnglish) {
      alert('Please create or enter English prompt first.');
      return;
    }

    if (state.selectedModel === ModelType.PRO_IMAGE || state.selectedModel === ModelType.GEMINI_3_1_FLASH_IMAGE_PREVIEW) {
      const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
      if (!hasKey) {
        alert("This model requires a paid API key. Please select one.");
        await (window as any).aistudio?.openSelectKey();
        return;
      }
    }

    updateState({ isLoading: true, statusMessage: 'Generating high-quality image...' });
    try {
      const imgUrl = await geminiService.generateImage(
        state.enhancePromptEnglish,
        state.selectedModel,
        state.selectedAspectRatio
      );
      updateState({ generatedImage: imgUrl });
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("Requested entity was not found")) {
        await (window as any).aistudio?.openSelectKey();
      } else {
        alert('Error creating image');
      }
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
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-[1000px] flex flex-col gap-6">
      {/* API Key Management Bar */}
              <div className="mb-6 p-4 bg-gray-900 border border-emerald-500/30 rounded-xl">
                        <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-emerald-400 uppercase text-left">
                                                  API Key Control Panel :
                                                              </label>
                                                                          <div className="flex flex-wrap sm:flex-nowrap gap-2">
                                                                                        <input
                                                                                                        type="text"
                                                                                                                        value={inputKey}
                                                                                                                                        onChange={(e) => setInputKey(e.target.value)}
                                                                                                                                                        className="w-full flex-1 bg-black border border-gray-700 rounded px-3 py-2 text-sm font-mono text-emerald-300 outline-none"
                                                                                                                                                                      />
                                                                                                                                                                                    <div className="flex gap-2 w-full sm:w-auto">
                                                                                                                                                                                                    <button onClick={handleSendKey} className="flex-1 bg-emerald-600 px-4 py-2 rounded text-xs font-bold hover:bg-emerald-700 transition-colors">SEND</button>
                                                                                                                                                                                                                    <button onClick={() => { navigator.clipboard.writeText(inputKey); alert("Copy แล้วครับ"); }} className="flex-1 bg-blue-600 px-4 py-2 rounded text-xs font-bold">COPY</button>
                                                                                                                                                                                                                                    <button onClick={() => { localStorage.removeItem('gemini_api_key'); setInputKey(''); alert("ลบ Key แล้วครับ"); }} className="flex-1 bg-red-600 px-4 py-2 rounded text-xs font-bold">CLEAR</button>
                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                </div>
        <h1 className="text-3xl font-extrabold text-indigo-700 text-center mb-4 uppercase tracking-wider">
          Prompt From Image
        </h1>

        {/* Text Reasoning Model Selection */}
        <div className="flex flex-col w-full">
          <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">Text Reasoning Model</label>
          <select 
            className="w-full p-2 border-2 border-gray-300 rounded-lg outline-none focus:border-indigo-500 transition-colors bg-white"
            value={state.selectedTextModel}
            onChange={(e) => updateState({ selectedTextModel: e.target.value as TextModelType })}
          >
<option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
<option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
<option value="gemini-3-pro-preview">Gemini 3.0 Pro Preview</option>
<option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite Preview</option>
<option value="gemini-flash-latest">Gemini Flash Latest</option>
<option value="gemini-flash-lite-latest">Gemini Flash Lite Latest</option>
<option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
<option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
<option value="gemini-pro-latest">Gemini Pro (Latest Stable)</option>
          </select>
        </div>

        {/* 1. Reference Image */}
        <div className="flex flex-col w-full">
          <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">Reference Image</label>
          <div className="w-full h-[300px] bg-gray-200 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex items-center justify-center">
            {state.referenceImage ? (
              <img 
                src={state.referenceImage} 
                alt="Reference" 
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <span className="text-gray-400">No Image Selected</span>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <button 
              onClick={handleOpenClick}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors font-medium"
            >
              Open
            </button>
            <button 
              onClick={() => updateState({ referenceImage: null })}
              className="px-4 py-2 bg-red-400 hover:bg-red-500 text-white rounded-md transition-colors font-medium"
            >
              Clear
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange}
          />
        </div>

        {/* 2. Image Style */}
        <div className="flex flex-col w-full">
          <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">Image Style</label>
          <select 
            className="w-full p-2 border-2 border-gray-300 rounded-lg outline-none focus:border-indigo-500 transition-colors"
            value={state.imageStyle}
            onChange={(e) => updateState({ imageStyle: e.target.value as ImageStyle })}
          >
            {Object.values(ImageStyle).map(style => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
        </div>

        {/* 3. Addition Details */}
        <NotepadArea 
          label="Addition Details"
          value={state.additionDetails}
          onChange={(val) => updateState({ additionDetails: val })}
          onCopy={() => copyToClipboard(state.additionDetails)}
          onClear={() => updateState({ additionDetails: '' })}
          placeholder="ระบุรายละเอียดเพิ่มเติมที่ต้องการดัดแปลง..."
        />

        {/* 5. Create Image Concept in Thai Button */}
        <button 
          onClick={handleCreateThaiConcept}
          disabled={state.isLoading}
          className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg font-bold text-lg shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
          {state.isLoading ? 'Processing...' : 'Create Image Concept in Thai'}
        </button>

        {/* 4. Image Concept in Thai */}
        <NotepadArea 
          label="Image Concept in Thai"
          value={state.imageConceptThai}
          onChange={(val) => updateState({ imageConceptThai: val })}
          onCopy={() => copyToClipboard(state.imageConceptThai)}
          onClear={() => updateState({ imageConceptThai: '' })}
          placeholder="Concept ภาพภาษาไทยจะแสดงที่นี่..."
        />

        {/* 6. Enhance Prompt in English Section */}
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-700 mb-1">
             <span>Max Prompt Length :</span>
             <input 
               type="number"
               className="w-20 p-1 border border-gray-300 rounded bg-white text-center notepad-font"
               value={state.maxPromptLength}
               onChange={(e) => updateState({ maxPromptLength: parseInt(e.target.value) || 0 })}
             />
             <span>characters</span>
          </div>
          <button 
            onClick={handleCreateEnhancedPrompt}
            disabled={state.isLoading}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg font-bold text-lg shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {state.isLoading ? 'Processing...' : 'Create enhance prompt in English'}
          </button>
        </div>

        <NotepadArea 
          label="enhance prompt in English"
          value={state.enhancePromptEnglish}
          onChange={(val) => updateState({ enhancePromptEnglish: val })}
          onCopy={() => copyToClipboard(state.enhancePromptEnglish)}
          onClear={() => updateState({ enhancePromptEnglish: '' })}
          placeholder="Enhanced English Prompt will appear here..."
        />

        {/* 7. Model Selection and Create Image */}
        <div className="flex flex-col gap-4 mb-10">
          <div className="flex flex-col">
            <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">Model สร้างภาพ</label>
            <select 
              className="w-full p-2 border-2 border-gray-300 rounded-lg outline-none focus:border-indigo-500 transition-colors"
              value={state.selectedModel}
              onChange={(e) => updateState({ selectedModel: e.target.value as ModelType })}
            >
<option value="gemini-2.5-flash-image">gemini-2.5-flash-image (Default)</option>
<option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview</option>
<option value="imagen-4.0-generate-001">imagen-4.0-generate-001</option>
<option value="gemini-flash-image-latest">Gemini Flash Image Latest</option>
<option value="gemini-pro-image-latest">Gemini Pro Image Latest</option>
<option value="gemini-flash-latest">gemini-flash-latest</option>
<option value="gemini-flash-lite-latest">gemini-flash-lite-latest</option>
<option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
<option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
<option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image (High Quality)</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">Aspect Ratio</label>
            <select 
              className="w-full p-2 border-2 border-gray-300 rounded-lg outline-none focus:border-indigo-500 transition-colors"
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
            {state.isLoading ? 'Generating Image...' : 'CREATE IMAGE'}
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
    </div>
  );
};

export default App;
