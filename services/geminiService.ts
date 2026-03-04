
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ImageStyle, ModelType, AspectRatio, TextModelType } from "../types";

const getAiInstance = () => {
  const savedKey = localStorage.getItem('gemini_api_key');
  const apiKey = savedKey || (window as any).process?.env?.API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export const generateConceptInThai = async (
  imageB64: string | null,
  additionDetails: string,
  imageStyle: ImageStyle,
  textModel: TextModelType
): Promise<string> => {
  const ai = getAiInstance();
  
  const parts: any[] = [];
  
  if (imageB64) {
    const base64Data = imageB64.split(',')[1];
    const mimeType = imageB64.split(';')[0].split(':')[1];
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
    2. วิเคราะห์ข้อมูลเพิ่มเติม: "${additionDetails}"
    3. พิจารณาสไตล์ภาพที่ต้องการ: "${imageStyle}"
    
    คำสั่ง:
    จงอธิบายคอนเซปต์สำหรับสร้างภาพขึ้นมาใหม่ โดยดัดแปลงให้สอดคล้องกับภาพอ้างอิง ข้อมูลเพิ่มเติม และสไตล์ที่เลือก
    ภาพต้องมีความสวยงาม โดดเด่น ดึงดูดสายตา และเข้าใจง่าย
    สำคัญมาก: ภาพที่อธิบายต้องไม่ผิดกฎเกณฑ์ของ YouTube ทุกรูปแบบ
    
    ผลลัพธ์: ให้ตอบเป็นภาษาไทยเท่านั้น โดยสรุปเป็น "Concept ของภาพ" ที่ชัดเจน เพื่อนำไปใช้สร้าง Prompt ต่อไป
  `;

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: textModel,
    contents: { parts },
  });

  return response.text || '';
};

export const generateEnhancedPrompt = async (
  thaiConcept: string,
  maxLength: number,
  textModel: TextModelType
): Promise<string> => {
  const ai = getAiInstance();

  const prompt = `
    คุณคือ Prompt Engineer ระดับมืออาชีพ เชี่ยวชาญการออกแบบภาพที่สวยงามและสื่อสารได้ทรงพลัง
    งานของคุณ: ศึกษาและวิเคราะห์ "Concept ภาพภาษาไทย" ด้านล่างนี้ แล้วออกแบบเป็น Image Generation Prompt ภาษาอังกฤษที่ละเอียด ชัดเจน และทรงพลังที่สุด

    Thai Concept: "${thaiConcept}"

    เงื่อนไข:
    1. สร้าง prompt ภาษาอังกฤษที่อธิบายรายละเอียดเชิงลึก (แสง, องค์ประกอบ, สี, บรรยากาศ)
    2. ความยาวทั้งหมด (รวมตัวอักษรและช่องว่าง) ต้องไม่เกิน ${maxLength} ตัวอักษร
    3. ภาพต้องสวยงาม โดดเด่น ดึงดูดสายตา และไม่ละเมิดกฎ YouTube
    
    คำสั่ง: ส่งกลับมาเฉพาะตัวข้อความ Prompt ภาษาอังกฤษเท่านั้น ห้ามมีคำเกริ่นนำ
  `;

  const response = await ai.models.generateContent({
    model: textModel,
    contents: prompt,
  });

  return response.text?.slice(0, maxLength).trim() || '';
};

export const generateImage = async (
  prompt: string,
  model: ModelType,
  aspectRatio: AspectRatio
): Promise<string> => {
  const ai = getAiInstance();

  if (model === ModelType.IMAGEN_4_0_GENERATE_001) {
    const response = await ai.models.generateImages({
        model: model,
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        },
    });
    const base64EncodeString: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64EncodeString}`;
  }

  // imageSize is only supported for gemini-3-pro-image-preview and gemini-3.1-flash-image-preview
  const imageConfig: any = {
    aspectRatio: aspectRatio,
  };

  if (model === ModelType.PRO_IMAGE || model === ModelType.GEMINI_3_1_FLASH_IMAGE_PREVIEW) {
    imageConfig.imageSize = "1K";
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: imageConfig,
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
};
