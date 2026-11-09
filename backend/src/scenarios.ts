export type Level = "beginner" | "intermediate" | "advanced";

export interface Scenario {
  id: string;
  emoji: string;
  title: string;
  titleKo: string;
  level: Level;
  /** 튜터가 맡을 역할과 상황 */
  role: string;
  /** 학습자가 대화에서 달성할 목표 */
  goalKo: string;
}

export const scenarios: Scenario[] = [
  {
    id: "free-talk",
    emoji: "💬",
    title: "Talk about your day",
    titleKo: "오늘 하루 이야기하기",
    level: "beginner",
    role: "a friendly tutor chatting casually with the learner about their day, plans and feelings",
    goalKo: "오늘 한 일과 기분을 세 문장 이상으로 말해 보세요.",
  },
  {
    id: "cafe",
    emoji: "☕",
    title: "Ordering at a café",
    titleKo: "카페에서 주문하기",
    level: "beginner",
    role: "a barista at a busy café taking the learner's order, asking about size, milk and whether it's for here or to go",
    goalKo: "음료와 사이즈를 고르고 결제까지 마쳐 보세요.",
  },
  {
    id: "directions",
    emoji: "🗺️",
    title: "Asking for directions",
    titleKo: "길 물어보기",
    level: "beginner",
    role: "a local person on the street in a big city helping the learner find the nearest subway station",
    goalKo: "목적지까지 가는 길을 묻고, 들은 내용을 다시 확인해 보세요.",
  },
  {
    id: "hotel",
    emoji: "🏨",
    title: "Hotel check-in",
    titleKo: "호텔 체크인",
    level: "intermediate",
    role: "a hotel front-desk clerk checking the learner in, confirming the reservation and explaining breakfast and Wi-Fi",
    goalKo: "예약을 확인하고 요청 사항 하나를 말해 보세요.",
  },
  {
    id: "coworker",
    emoji: "🤝",
    title: "Meeting a new coworker",
    titleKo: "새 동료와 스몰토크",
    level: "intermediate",
    role: "a new coworker meeting the learner at the office coffee machine, making small talk about work and weekends",
    goalKo: "자기소개를 하고 상대에게 질문 두 개를 던져 보세요.",
  },
  {
    id: "doctor",
    emoji: "🩺",
    title: "At the clinic",
    titleKo: "병원에서 증상 말하기",
    level: "intermediate",
    role: "a doctor at a clinic asking the learner about their symptoms, how long they have had them, and giving simple advice",
    goalKo: "증상과 언제부터 아팠는지 설명해 보세요.",
  },
  {
    id: "interview",
    emoji: "💼",
    title: "Job interview",
    titleKo: "영어 면접",
    level: "advanced",
    role: "an interviewer at a tech company asking the learner common interview questions about experience, strengths and goals",
    goalKo: "경험 하나를 구체적인 예시와 함께 설명해 보세요.",
  },
];

const LEVEL_GUIDE: Record<Level, string> = {
  beginner: "The learner is a beginner (CEFR A1-A2). Use very short, simple sentences and speak slowly and clearly.",
  intermediate: "The learner is intermediate (CEFR B1). Use everyday language and natural but clear speech.",
  advanced: "The learner is upper-intermediate (CEFR B2+). Speak naturally, and occasionally introduce useful phrases.",
};

export function buildSystemInstruction(s: Scenario, level: Level, targetWords: string[]): string {
  return [
    "You are a warm, encouraging English conversation tutor for a Korean learner.",
    `Role-play scenario: you are ${s.role}. Stay in this role.`,
    LEVEL_GUIDE[level],
    "Mostly use high-frequency English words (from the New General Service List).",
    "Keep each of your turns short (1-3 sentences) and usually end with a question so the learner keeps speaking. Let the learner talk more than you.",
    `Target words for this session: ${targetWords.join(", ")}. Use them naturally yourself and create chances for the learner to use them. Do not list them all at once.`,
    "When the learner makes a clear grammar or word-choice mistake, briefly say the correct version in one short sentence (a natural recast), then continue the conversation.",
    "If the learner is stuck or speaks Korean, give a short hint in simple English, adding a brief Korean translation only when really needed.",
    "Begin by greeting the learner and opening the scenario.",
  ].join("\n");
}
