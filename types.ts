
export enum ImageStyle {
  REFERENCE = 'เหมือนภาพอ้างอิง',
  CINEMATIC = 'Cinematic',
  CARTOON = 'Cartoon/Illustration',
  ANIME = 'Anime Style',
  REALISTIC = 'Photo Realistic',
  THREE_D_RENDER = '3D Render',
  OIL_PAINTING = 'Oil Painting',
  PIXEL_ART = 'Pixel Art',
}

export enum TextModelType {
  GEMINI_3_FLASH_PREVIEW = 'gemini-3-flash-preview',
  GEMINI_3_1_PRO_PREVIEW = 'gemini-3.1-pro-preview',
  GEMINI_FLASH_LATEST = 'gemini-flash-latest',
  GEMINI_3_1_FLASH_LITE_PREVIEW = 'gemini-3.1-flash-lite-preview',
}

export enum ModelType {
  FLASH_IMAGE = 'gemini-2.5-flash-image',
  PRO_IMAGE = 'gemini-3-pro-image-preview',
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface AppState {
  referenceImage: string | null;
  imageStyle: ImageStyle;
  additionDetails: string;
  imageConceptThai: string;
  enhancePromptEnglish: string;
  maxPromptLength: number;
  selectedTextModel: TextModelType;
  selectedModel: ModelType;
  selectedAspectRatio: AspectRatio;
  generatedImage: string | null;
  isLoading: boolean;
  statusMessage: string;
}
