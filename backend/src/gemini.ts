import { GoogleGenAI, Modality, type LiveConnectConfig } from "@google/genai";

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";
export const liveConfigured = Boolean(process.env.GEMINI_API_KEY);

const client = liveConfigured ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export function liveConfig(systemInstruction: string, voiceName: string): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
  };
}

/**
 * 브라우저가 Live API에 직접 연결할 수 있는 1회용 임시 토큰을 발급합니다.
 * 모델과 설정(시스템 프롬프트 포함)을 토큰에 잠가서, 클라이언트가 다른 용도로 쓰지 못하게 합니다.
 * API 키는 서버 밖으로 나가지 않습니다.
 */
export async function createLiveToken(config: LiveConnectConfig) {
  if (!client) throw new Error("GEMINI_API_KEY is not set");
  const now = Date.now();
  const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: { model: LIVE_MODEL, config },
    },
  });
  if (!token.name) throw new Error("Token response had no name");
  return { token: token.name, expireTime };
}
