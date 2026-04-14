
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the GoogleGenAI with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface KeywordEstimate {
  text: string;
  frequency: number;
  exactFrequency: number;
}

/**
 * Utility for retrying API calls with basic backoff for stability
 */
async function callWithRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
       throw new Error("QUOTA_EXCEEDED");
    }

    if (retries > 0 && (error?.status === 500 || error?.status === 503 || error?.message?.includes('xhr error') || error?.message?.includes('ProxyUnaryCall'))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

const handleApiError = (e: any) => {
  if (e.message === "QUOTA_EXCEEDED") {
    alert("Превышена квота запросов API Gemini. Пожалуйста, подождите 1-2 минуты или переключитесь на платный тариф (billing).");
  } else {
    alert("Не удалось вызвать API Gemini. Попробуйте еще раз позже.");
  }
  console.error(e);
};

const keywordDataSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: "Текст ключевой фразы" },
      frequency: { type: Type.INTEGER, description: "Оценочная общая частотность (запросов в месяц)" },
      exactFrequency: { type: Type.INTEGER, description: "Оценочная точная частотность (в кавычках)" }
    },
    required: ["text", "frequency", "exactFrequency"]
  }
};

export const fetchSynonymsAndSuggestions = async (theme: string): Promise<KeywordEstimate[]> => {
  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Ты - эксперт по контекстной рекламе и SEO. 
        Сгенерируй МАКСИМАЛЬНО ОБШИРНЫЙ, РАЗНООБРАЗНЫЙ и ГЛУБОКИЙ список ключевых фраз (не менее 60-80 штук) для тематики: "${theme}".
        Включи:
        1. Прямые коммерческие запросы (заказать, купить, цена, стоимость).
        2. Синонимы и близкие по смыслу фразы.
        3. LSI-слова и околотематические запросы.
        4. Гео-зависимые запросы (если уместно).
        5. Низкочастотные уточняющие запросы.
        6. Информационные запросы (как, почему, отзывы, рейтинг).
        
        Для каждого слова оцени его популярность (общую частотность и точную частотность).
        Верни результат строго в формате JSON.`,
        config: {
          temperature: 0.9,
          responseMimeType: "application/json",
          responseSchema: keywordDataSchema
        },
      });
      
      return JSON.parse(response.text || "[]") as KeywordEstimate[];
    });
  } catch (e) {
    handleApiError(e);
    return [];
  }
};

export const expandKeywords = async (baseKeywords: string[], theme: string): Promise<KeywordEstimate[]> => {
  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Расширь список ключевых слов на основе семян: ${baseKeywords.join(', ')}.
        Тематика: "${theme}". Включай коммерческие комбинации (цена, купить, заказать, под ключ).
        Для каждой новой фразы оцени примерную месячную популярность (общую и точную частотность).
        Верни результат строго в формате JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: keywordDataSchema
        },
      });

      return JSON.parse(response.text || "[]") as KeywordEstimate[];
    });
  } catch (e) {
    handleApiError(e);
    return [];
  }
};

export const estimateFrequenciesForList = async (keywords: string[], theme: string): Promise<KeywordEstimate[]> => {
  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Для следующего списка фраз в контексте ниши "${theme}" оцени их примерную популярность (количество поисковых запросов в месяц: общая частотность и точная частотность):
        ${keywords.join('\n')}
        Верни результат строго в формате JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: keywordDataSchema
        },
      });

      return JSON.parse(response.text || "[]") as KeywordEstimate[];
    });
  } catch (e) {
    handleApiError(e);
    return [];
  }
};

export const smartFilterKeywords = async (keywords: string[], theme: string) => {
  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Проанализируй список слов для ниши "${theme}":
        ${keywords.map((k, i) => `${i}: ${k}`).join('\n')}
        Найди мусорные запросы (инфо, работа, бесплатно, рефераты и т.д.). Верни JSON массив их индексов.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER }
          },
        },
      });

      return JSON.parse(response.text || "[]") as number[];
    });
  } catch (e) {
    handleApiError(e);
    return [];
  }
};
