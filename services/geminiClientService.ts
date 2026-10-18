import { GoogleGenAI } from "@google/genai";
import { ImageStyle, ModelType, AspectRatio, TextModelType } from "../types";
import { shouldUseDirectClientCalls } from "../src/utils/environmentUtils";
import { resolveModelName, buildModelCascade } from "./modelResolver";
import { getCachedCentralAIModels, CentralAIModel } from "./firebaseModelService";
import { executionTracker } from "./executionTracker";

/**
 * Multi-Source Key Resolution for client
 */
export function getClientApiKey(): string {
  if (typeof window === 'undefined') return '';
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey && savedKey.trim() && savedKey !== 'no API key') {
    return savedKey.trim();
  }
  const winKey = (window as any).process?.env?.API_KEY || (window as any).process?.env?.GEMINI_API_KEY;
  if (winKey && winKey.trim() && winKey !== 'no API key') {
    return winKey.trim();
  }
  try {
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {}
  return '';
}

function getAiInstance(overrideKey?: string) {
  const apiKey = overrideKey || getClientApiKey();
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Direct Client-Side Fallback Loop Executor
 */
async function executeDirectClientCascade<T>(
  task: 'concept' | 'prompt' | 'image',
  requestedModel: string,
  category: 'text' | 'image',
  centralModels: CentralAIModel[],
  executeFn: (model: string, ai: GoogleGenAI) => Promise<T>
): Promise<{ result: T; actualModel: string }> {
  const apiKey = getClientApiKey();
  const keySource = apiKey ? 'local_storage' : 'direct_client';
  const ai = getAiInstance(apiKey);

  const modelsToTry = buildModelCascade(requestedModel, centralModels, category);
  const attempts: Array<{ model: string; success: boolean; error?: string; latencyMs: number }> = [];
  const startOverall = Date.now();
  let lastError: any = null;

  for (const model of modelsToTry) {
    const attemptStart = Date.now();
    try {
      const result = await executeFn(model, ai);
      const attemptDuration = Date.now() - attemptStart;
      attempts.push({ model, success: true, latencyMs: attemptDuration });

      const resolved = resolveModelName(requestedModel);
      const isFallback = model !== requestedModel && model !== resolved;

      executionTracker.addLog({
        task,
        requestedModel,
        actualModel: model,
        keySource,
        latencyMs: Date.now() - startOverall,
        status: isFallback ? 'fallback_success' : 'success',
        attempts,
      });

      return { result, actualModel: model };
    } catch (err: any) {
      const attemptDuration = Date.now() - attemptStart;
      const msg = err?.message || String(err);
      console.warn(`[Client Direct Cascade] Model ${model} failed: ${msg}. Trying next...`);
      attempts.push({ model, success: false, error: msg, latencyMs: attemptDuration });
      lastError = err;
    }
  }

  const failedError = lastError?.message || 'All direct fallback models failed';
  executionTracker.addLog({
    task,
    requestedModel,
    actualModel: modelsToTry[0] || requestedModel,
    keySource,
    latencyMs: Date.now() - startOverall,
    status: 'failed',
    attempts,
    error: failedError,
  });

  throw new Error(`Execution failed: ${failedError}`);
}

/**
 * 1. Generate Thai Concept from Reference Image & Details
 */
export async function generateConceptInThai(
  imageB64: string | null,
  additionDetails: string,
  imageStyle: ImageStyle,
  textModel: TextModelType | string,
  customCentralModels?: CentralAIModel[]
): Promise<string> {
  const centralModels = customCentralModels || getCachedCentralAIModels().textModels;
  const useDirect = shouldUseDirectClientCalls();
  const apiKey = getClientApiKey();

  if (!useDirect) {
    try {
      const res = await fetch('/api/ai/concept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey,
        },
        body: JSON.stringify({
          imageB64,
          additionDetails,
          imageStyle,
          requestedModel: textModel,
          centralModels,
          apiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          executionTracker.addLog({
            task: 'concept',
            requestedModel: textModel,
            actualModel: data.actualModel,
            keySource: data.keySource || (apiKey ? 'local_storage' : 'server_env'),
            latencyMs: data.latencyMs || 0,
            status: data.fallbackUsed ? 'fallback_success' : 'success',
            attempts: data.attempts || [],
          });
          return data.result;
        }
      }
      console.warn("Server proxy concept generation returned non-ok, falling back to direct client execution...");
    } catch (netErr) {
      console.warn("Server proxy unavailable, falling back to direct client execution:", netErr);
    }
  }

  // Direct Client Execution (or fallback if proxy was down)
  const directResult = await executeDirectClientCascade(
    'concept',
    textModel,
    'text',
    centralModels,
    async (model, ai) => {
      const parts: any[] = [];
      if (imageB64) {
        const partsSplit = imageB64.split(',');
        const base64Data = partsSplit.length > 1 ? partsSplit[1] : partsSplit[0];
        const mimeMatch = imageB64.match(/^data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        });
      }

      const prompt = `
        คุณคือผู้เชี่ยวชาญระดับสูงในการวิเคราะห์ภาพและสร้างสรรค์ภาพประกอบ
        บทบาท: นักวิเคราะห์ภาพและนักสร้างภาพอธิบายเรื่องราวที่มีความรู้ความสามารถสูง เชี่ยวชาญทั้งจิตวิทยาการเรียนการสอน การสื่อสารให้เห็นภาพ และมีศิลปะในการสร้างภาพที่สวยงาม โดดเด่น ดึงดูดสายตา

        งานของคุณ:
        1. ศึกษาภาพอ้างอิง (ถ้ามี)
        2. วิเคราะห์ข้อมูลเพิ่มเติม: "${additionDetails || ''}"
        3. พิจารณาสไตล์ภาพที่ต้องการ: "${imageStyle || 'เหมือนภาพอ้างอิง'}"
        
        คำสั่ง:
        จงอธิบายคอนเซปต์สำหรับสร้างภาพขึ้นมาใหม่ โดยดัดแปลงให้สอดคล้องกับภาพอ้างอิง ข้อมูลเพิ่มเติม และสไตล์ที่เลือก
        ภาพต้องมีความสวยงาม โดดเด่น ดึงดูดสายตา และเข้าใจง่าย
        สำคัญมาก: ภาพที่อธิบายต้องไม่ผิดกฎเกณฑ์ของ YouTube ทุกรูปแบบ
        
        ผลลัพธ์: ให้ตอบเป็นภาษาไทยเท่านั้น โดยสรุปเป็น "Concept ของภาพ" ที่ชัดเจน เพื่อนำไปใช้สร้าง Prompt ต่อไป
      `;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
      });

      return response.text || '';
    }
  );

  return directResult.result;
}

/**
 * 2. Generate Enhanced English Prompt from Thai Concept
 */
export async function generateEnhancedPrompt(
  thaiConcept: string,
  maxLength: number,
  textModel: TextModelType | string,
  customCentralModels?: CentralAIModel[]
): Promise<string> {
  const centralModels = customCentralModels || getCachedCentralAIModels().textModels;
  const useDirect = shouldUseDirectClientCalls();
  const apiKey = getClientApiKey();

  if (!useDirect) {
    try {
      const res = await fetch('/api/ai/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey,
        },
        body: JSON.stringify({
          thaiConcept,
          maxLength,
          requestedModel: textModel,
          centralModels,
          apiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          executionTracker.addLog({
            task: 'prompt',
            requestedModel: textModel,
            actualModel: data.actualModel,
            keySource: data.keySource || (apiKey ? 'local_storage' : 'server_env'),
            latencyMs: data.latencyMs || 0,
            status: data.fallbackUsed ? 'fallback_success' : 'success',
            attempts: data.attempts || [],
          });
          return data.result;
        }
      }
      console.warn("Server proxy prompt generation returned non-ok, falling back to direct client execution...");
    } catch (netErr) {
      console.warn("Server proxy prompt generation failed, falling back to direct client execution:", netErr);
    }
  }

  // Direct Client Execution
  const directResult = await executeDirectClientCascade(
    'prompt',
    textModel,
    'text',
    centralModels,
    async (model, ai) => {
      const prompt = `
        คุณคือ Prompt Engineer ระดับมืออาชีพ เชี่ยวชาญการออกแบบภาพที่สวยงามและสื่อสารได้ทรงพลัง
        งานของคุณ: ศึกษาและวิเคราะห์ "Concept ภาพภาษาไทย" ด้านล่างนี้ แล้วออกแบบเป็น Image Generation Prompt ภาษาอังกฤษที่ละเอียด ชัดเจน และทรงพลังที่สุด

        Thai Concept: "${thaiConcept || ''}"

        เงื่อนไข:
        1. สร้าง prompt ภาษาอังกฤษที่อธิบายรายละเอียดเชิงลึก (แสง, องค์ประกอบ, สี, บรรยากาศ)
        2. ความยาวทั้งหมด (รวมตัวอักษรและช่องว่าง) ต้องไม่เกิน ${maxLength} ตัวอักษร
        3. ภาพต้องสวยงาม โดดเด่น ดึงดูดสายตา และไม่ละเมิดกฎ YouTube
        
        คำสั่ง: ส่งกลับมาเฉพาะตัวข้อความ Prompt ภาษาอังกฤษเท่านั้น ห้ามมีคำเกริ่นนำ
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      return response.text?.slice(0, maxLength).trim() || '';
    }
  );

  return directResult.result;
}

/**
 * 3. Generate Image using Gemini Image / Imagen models
 */
export async function generateImage(
  prompt: string,
  model: ModelType | string,
  aspectRatio: AspectRatio,
  customCentralModels?: CentralAIModel[]
): Promise<string> {
  const centralModels = customCentralModels || getCachedCentralAIModels().imageModels;
  const useDirect = shouldUseDirectClientCalls();
  const apiKey = getClientApiKey();

  if (!useDirect) {
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey,
        },
        body: JSON.stringify({
          prompt,
          requestedModel: model,
          aspectRatio,
          centralModels,
          apiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          executionTracker.addLog({
            task: 'image',
            requestedModel: model,
            actualModel: data.actualModel,
            keySource: data.keySource || (apiKey ? 'local_storage' : 'server_env'),
            latencyMs: data.latencyMs || 0,
            status: data.fallbackUsed ? 'fallback_success' : 'success',
            attempts: data.attempts || [],
          });
          return data.result;
        }
      }
      console.warn("Server proxy image generation returned non-ok, falling back to direct client execution...");
    } catch (netErr) {
      console.warn("Server proxy image generation failed, falling back to direct client execution:", netErr);
    }
  }

  // Direct Client Execution
  const directResult = await executeDirectClientCascade(
    'image',
    model,
    'image',
    centralModels,
    async (targetModel, ai) => {
      if (targetModel.includes('imagen')) {
        const response = await ai.models.generateImages({
          model: targetModel,
          prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio,
          },
        });
        const base64EncodeString = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64EncodeString}`;
      }

      const imageConfig: any = {
        aspectRatio,
      };

      if (targetModel.includes('pro-image') || targetModel.includes('3.1-flash-image')) {
        imageConfig.imageSize = "1K";
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig,
        },
      });

      let imageUrl = '';
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (!imageUrl) throw new Error("Could not extract image from response");
      return imageUrl;
    }
  );

  return directResult.result;
}

/**
 * 4. Test Gemini API Key connectivity
 */
export async function testGeminiApiKey(keyToTest: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  try {
    const res = await fetch('/api/ai/test-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey: keyToTest }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        latencyMs: data.latencyMs || (Date.now() - start),
        message: 'เชื่อมต่อ Gemini API สำเร็จสมบูรณ์ (Key ใช้งานได้ปกติ)',
      };
    }

    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'API Key test failed');
  } catch (err: any) {
    // Direct Client fallback test
    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: 'ping',
      });
      return {
        success: true,
        latencyMs: Date.now() - start,
        message: 'เชื่อมต่อ Gemini API สำเร็จสมบูรณ์ (ผ่าน Direct Client)',
      };
    } catch (directErr: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: directErr.message || err.message || 'การตรวจสอบ API Key ล้มเหลว',
      };
    }
  }
}
