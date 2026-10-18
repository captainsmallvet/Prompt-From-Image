import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { buildModelCascade, resolveModelName } from './services/modelResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Multi-Source API Key Resolution
 * Priority:
 * 1. x-gemini-api-key Header
 * 2. Authorization: Bearer <token> Header
 * 3. Body apiKey field
 * 4. Server environment variable GEMINI_API_KEY or API_KEY
 */
function resolveApiKey(req: Request): { apiKey: string; source: 'client_header' | 'local_storage' | 'server_env' } {
  const headerKey = (req.headers['x-gemini-api-key'] as string) || '';
  if (headerKey && headerKey.trim() && headerKey !== 'no API key') {
    return { apiKey: headerKey.trim(), source: 'client_header' };
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const bearerKey = authHeader.substring(7).trim();
    if (bearerKey && bearerKey !== 'no API key') {
      return { apiKey: bearerKey, source: 'client_header' };
    }
  }

  const bodyKey = (req.body?.apiKey as string) || '';
  if (bodyKey && bodyKey.trim() && bodyKey !== 'no API key') {
    return { apiKey: bodyKey.trim(), source: 'local_storage' };
  }

  const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (envKey && envKey.trim()) {
    return { apiKey: envKey.trim(), source: 'server_env' };
  }

  return { apiKey: '', source: 'server_env' };
}

function createAiClient(apiKey: string) {
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
 * Server-Side Smart Cascade Fallback Executor
 */
async function runWithModelTracking<T>(
  req: Request,
  category: 'text' | 'image',
  requestedModel: string,
  centralModels: any[],
  executeFn: (model: string, ai: GoogleGenAI) => Promise<T>
): Promise<{
  result: T;
  actualModel: string;
  requestedModel: string;
  keySource: 'client_header' | 'local_storage' | 'server_env' | 'direct_client';
  latencyMs: number;
  attempts: Array<{ model: string; success: boolean; error?: string; latencyMs: number }>;
  fallbackUsed: boolean;
}> {
  const { apiKey, source } = resolveApiKey(req);
  if (!apiKey) {
    throw new Error("No Gemini API key available. Please configure your key in Settings or environment variable.");
  }

  const ai = createAiClient(apiKey);
  const modelsToTry = buildModelCascade(requestedModel, centralModels, category);
  const attempts: Array<{ model: string; success: boolean; error?: string; latencyMs: number }> = [];
  const overallStart = Date.now();

  let lastError: any = null;

  for (const model of modelsToTry) {
    const attemptStart = Date.now();
    try {
      const result = await executeFn(model, ai);
      const attemptDuration = Date.now() - attemptStart;
      attempts.push({ model, success: true, latencyMs: attemptDuration });

      return {
        result,
        actualModel: model,
        requestedModel,
        keySource: source,
        latencyMs: Date.now() - overallStart,
        attempts,
        fallbackUsed: model !== requestedModel && model !== resolveModelName(requestedModel),
      };
    } catch (err: any) {
      const attemptDuration = Date.now() - attemptStart;
      const errorMessage = err?.message || String(err);
      console.warn(`[Cascade Fallback] Model ${model} failed (${errorMessage}). Trying next...`);
      attempts.push({ model, success: false, error: errorMessage, latencyMs: attemptDuration });
      lastError = err;
    }
  }

  throw new Error(`All cascade models failed for ${category}. Last error: ${lastError?.message || lastError}`);
}

// API Routes
app.post('/api/ai/concept', async (req: Request, res: Response) => {
  try {
    const { imageB64, additionDetails, imageStyle, requestedModel, centralModels } = req.body;

    const outcome = await runWithModelTracking(
      req,
      'text',
      requestedModel || 'gemini-3.5-flash',
      centralModels || [],
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

    res.json({ success: true, ...outcome });
  } catch (err: any) {
    console.error("API /api/ai/concept Error:", err);
    res.status(500).json({ success: false, error: err.message || 'Error generating concept' });
  }
});

app.post('/api/ai/prompt', async (req: Request, res: Response) => {
  try {
    const { thaiConcept, maxLength, requestedModel, centralModels } = req.body;
    const maxLen = typeof maxLength === 'number' ? maxLength : 800;

    const outcome = await runWithModelTracking(
      req,
      'text',
      requestedModel || 'gemini-3.5-flash',
      centralModels || [],
      async (model, ai) => {
        const prompt = `
          คุณคือ Prompt Engineer ระดับมืออาชีพ เชี่ยวชาญการออกแบบภาพที่สวยงามและสื่อสารได้ทรงพลัง
          งานของคุณ: ศึกษาและวิเคราะห์ "Concept ภาพภาษาไทย" ด้านล่างนี้ แล้วออกแบบเป็น Image Generation Prompt ภาษาอังกฤษที่ละเอียด ชัดเจน และทรงพลังที่สุด

          Thai Concept: "${thaiConcept || ''}"

          เงื่อนไข:
          1. สร้าง prompt ภาษาอังกฤษที่อธิบายรายละเอียดเชิงลึก (แสง, องค์ประกอบ, สี, บรรยากาศ)
          2. ความยาวทั้งหมด (รวมตัวอักษรและช่องว่าง) ต้องไม่เกิน ${maxLen} ตัวอักษร
          3. ภาพต้องสวยงาม โดดเด่น ดึงดูดสายตา และไม่ละเมิดกฎ YouTube
          
          คำสั่ง: ส่งกลับมาเฉพาะตัวข้อความ Prompt ภาษาอังกฤษเท่านั้น ห้ามมีคำเกริ่นนำ
        `;

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        return response.text?.slice(0, maxLen).trim() || '';
      }
    );

    res.json({ success: true, ...outcome });
  } catch (err: any) {
    console.error("API /api/ai/prompt Error:", err);
    res.status(500).json({ success: false, error: err.message || 'Error generating prompt' });
  }
});

app.post('/api/ai/image', async (req: Request, res: Response) => {
  try {
    const { prompt, requestedModel, aspectRatio, centralModels } = req.body;

    const outcome = await runWithModelTracking(
      req,
      'image',
      requestedModel || 'gemini-2.5-flash-image',
      centralModels || [],
      async (model, ai) => {
        if (model.includes('imagen')) {
          const response = await ai.models.generateImages({
            model,
            prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: aspectRatio || '16:9',
            },
          });
          const base64EncodeString = response.generatedImages[0].image.imageBytes;
          return `data:image/jpeg;base64,${base64EncodeString}`;
        }

        const imageConfig: any = {
          aspectRatio: aspectRatio || '16:9',
        };

        if (model.includes('pro-image') || model.includes('3.1-flash-image')) {
          imageConfig.imageSize = "1K";
        }

        const response = await ai.models.generateContent({
          model,
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

    res.json({ success: true, ...outcome });
  } catch (err: any) {
    console.error("API /api/ai/image Error:", err);
    res.status(500).json({ success: false, error: err.message || 'Error generating image' });
  }
});

// Test API Key verification endpoint
app.post('/api/ai/test-key', async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { apiKey } = req.body;
    const resolved = resolveApiKey(req);
    const keyToTest = apiKey || resolved.apiKey;

    if (!keyToTest) {
      return res.status(400).json({ success: false, error: 'No API key provided to test.' });
    }

    const ai = createAiClient(keyToTest);
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Respond with exactly: OK',
    });

    const latency = Date.now() - start;
    return res.json({
      success: true,
      text: response.text?.trim() || 'OK',
      latencyMs: latency,
      testedModel: 'gemini-3.5-flash',
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Invalid API Key or connection failed',
      latencyMs: Date.now() - start,
    });
  }
});

// Full-stack Vite integration
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`> Server ready on http://0.0.0.0:${PORT} [${isProd ? 'production' : 'development'}]`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
