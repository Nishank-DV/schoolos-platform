/**
 * CareerBuddy GenAI adapter – PRD-aligned.
 * LM Studio (local) with fallback mock.
 * Set LM_STUDIO_URL=http://localhost:1234/v1 to use LM Studio.
 */

const LM_STUDIO_URL = process.env.LM_STUDIO_URL ?? "";
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL ?? "local-model";
const LM_STUDIO_KEY = process.env.LM_STUDIO_KEY ?? "lm-studio";
const LM_STUDIO_TIMEOUT_MS = 4000;
const WARN_COOLDOWN_MS = 60_000;

const warningTimestamps = new Map<string, number>();

function warnWithCooldown(key: string, message: string) {
  const now = Date.now();
  const last = warningTimestamps.get(key) ?? 0;
  if (now - last < WARN_COOLDOWN_MS) return;
  warningTimestamps.set(key, now);
  console.warn(message);
}

const DEFAULT_OPTIONS = ["Strongly Agree", "Agree", "Neutral", "Disagree", "Strongly Disagree"];

type CareerProfile = {
  favoriteSubjects: string[];
  hobbies: string[];
  likedActivities: string[];
  dislikedActivities: string[];
  student?: { firstName?: string; lastName?: string; grade?: number };
};

type AssessmentResponse = {
  questionId: string;
  answer: string;
  question?: { category: string; question: string; options: string[] };
};

export type CareerRecommendationDetail = {
  career: string;
  overview?: string;
  skillsRequired?: string;
  educationPath?: string;
  futureDemand?: string;
};

export type StreamRecommendationResult = {
  recommended: string;
  alternateStreams: string[];
};

async function chat(prompt: string, system?: string, maxTokens = 500): Promise<string> {
  if (!LM_STUDIO_URL) return "";
  try {
    const res = await fetch(`${LM_STUDIO_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(LM_STUDIO_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LM_STUDIO_KEY}`,
      },
      body: JSON.stringify({
        model: LM_STUDIO_MODEL,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      warnWithCooldown("lmstudio-http", `LM Studio unavailable (HTTP ${res.status}). Falling back to mock responses.`);
      return "";
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown error";
    warnWithCooldown("lmstudio-fetch", `LM Studio request failed (${reason}). Falling back to mock responses.`);
    return "";
  }
}

// PRD 5.2: Interest (technology, science, business, design, social impact), Personality (analytical, creativity, leadership, empathy, curiosity, collaboration), Aptitude (logical, numerical, pattern, language)
const INTEREST_THEMES = ["technology", "science", "business", "design", "social impact"];
const PERSONALITY_TRAITS = ["analytical thinking", "creativity", "leadership", "empathy", "curiosity", "collaboration"];
const APTITUDE_AREAS = ["logical reasoning", "numerical reasoning", "pattern recognition", "language ability"];

const FALLBACK_QUESTION_BANK: Record<string, string[]> = {
  interest: [
    "Do you enjoy solving logical problems and building things?",
    "Would you like working on projects that improve your community?",
    "Do you prefer exploring how machines and technology work?",
    "Are you excited by creating ideas for businesses or products?",
  ],
  personality: [
    "Would you enjoy leading a team on a project?",
    "Do you like brainstorming many creative ideas before choosing one?",
    "Do you enjoy helping classmates understand difficult concepts?",
    "Are you comfortable presenting your ideas to a group?",
  ],
  aptitude: [
    "Do you find it easy to learn new software or tools?",
    "Do number puzzles and patterns feel natural to you?",
    "Can you usually explain complex ideas in simple words?",
    "Do you quickly spot mistakes in calculations or logic?",
  ],
};

export const genaiAdapter = {
  async generateAssessmentQuestion(
    category: string,
    profile: CareerProfile,
    previousResponses?: AssessmentResponse[]
  ): Promise<{ question: string; options: string[] }> {
    const context = `Student favorite subjects: ${profile.favoriteSubjects.join(", ") || "none"}. Hobbies: ${profile.hobbies.join(", ") || "none"}. Likes: ${profile.likedActivities.join(", ") || "none"}. Dislikes: ${profile.dislikedActivities.join(", ") || "none"}.`;
    const answeredSoFar = previousResponses?.length ?? 0;
    let theme = "";
    if (category === "interest") theme = INTEREST_THEMES[answeredSoFar % INTEREST_THEMES.length];
    if (category === "personality") theme = PERSONALITY_TRAITS[answeredSoFar % PERSONALITY_TRAITS.length];
    if (category === "aptitude") theme = APTITUDE_AREAS[answeredSoFar % APTITUDE_AREAS.length];
    const prompt = `Generate exactly one short multiple-choice question for a career assessment for a 14-16 year old student.
Category: ${category}. Theme: ${theme || category}.
${context}
${previousResponses?.length ? `So far they have answered ${previousResponses.length} questions.` : ""}
Return only the question text, one line, no numbering. Examples: "Do you enjoy solving logical problems?", "Would you like designing a mobile application?", "Do you prefer leading teams or working independently?"`;
    const system = "You are a career counselor for school students. Output only the question, one line.";
    const text = await chat(prompt, system, 150);
    const fallbackList = FALLBACK_QUESTION_BANK[category] ?? ["Do you prefer working with people or with data?"];
    const fallbackQuestion = fallbackList[answeredSoFar % fallbackList.length];
    const question = text ? text.replace(/^\d+\.\s*/, "").trim() : fallbackQuestion;
    return { question, options: DEFAULT_OPTIONS };
  },

  async analyzeAssessmentResponses(
    profile: CareerProfile,
    responses: AssessmentResponse[]
  ): Promise<{ interestProfile: string; personalityIndicators: string[]; aptitudeIndicators: string[] }> {
    const prompt = `Based on a student's profile (favorite subjects: ${profile.favoriteSubjects.join(", ")}, hobbies: ${profile.hobbies.join(", ")}) and their ${responses.length} assessment answers, provide:
1. A 2-3 sentence "Interest Profile" summary (e.g. "Strong interest in technology and problem-solving").
2. Up to 4 personality indicators from: analytical thinking, creativity, leadership, empathy, curiosity, collaboration. Comma-separated.
3. Up to 3 aptitude indicators from: logical reasoning, numerical reasoning, pattern recognition, language ability. Comma-separated.
Format exactly: INTEREST: [paragraph] PERSONALITY: [comma list] APTITUDE: [comma list]`;
    const text = await chat(prompt, undefined, 300);
    let interestProfile = "Analytical and technical interests; enjoys problem-solving and building.";
    let personalityIndicators = ["Structured", "Goal-oriented", "Curious"];
    let aptitudeIndicators = ["Logical reasoning", "Problem-solving"];
    if (text) {
      const intMatch = text.match(/INTEREST:\s*([^\n]+(?:\n(?!PERSONALITY:)[^\n]+)*)/i);
      const persMatch = text.match(/PERSONALITY:\s*([^\n]+)/i);
      const aptMatch = text.match(/APTITUDE:\s*([^\n]+)/i);
      if (intMatch) interestProfile = intMatch[1].replace(/\s+/g, " ").trim();
      if (persMatch) personalityIndicators = persMatch[1].split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
      if (aptMatch) aptitudeIndicators = aptMatch[1].split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
    }
    return { interestProfile, personalityIndicators, aptitudeIndicators };
  },

  async generateCareerRecommendations(
    profile: CareerProfile,
    responses: AssessmentResponse[]
  ): Promise<{
    topCareers: CareerRecommendationDetail[];
    alternateCareers: CareerRecommendationDetail[];
    summary: string;
    skillDevelopmentSuggestions: string[];
  }> {
    const context = `Favorite subjects: ${profile.favoriteSubjects.join(", ")}. Hobbies: ${profile.hobbies.join(", ")}. ${responses.length} assessment responses.`;
    const prompt = `For a Grade ${profile.student?.grade ?? 10} student. ${context}
Suggest 5 top career matches and 3 alternate careers. For each career provide: career name, one-line overview, skills required (comma-separated), education path (one line), future demand (one line).
Format: TOP: name1 | overview1 | skills1 | education1 | demand1 ; name2 | ... ALT: name1 | ... ; ...
Then: SUMMARY: [2 sentences] SKILLS: [suggestion1; suggestion2; suggestion3]`;
    const text = await chat(prompt, undefined, 800);
    const topCareers: CareerRecommendationDetail[] = [
      { career: "Software Engineer", overview: "Build and maintain software applications.", skillsRequired: "Programming, problem-solving", educationPath: "B.Tech/B.E. in CSE or related", futureDemand: "High" },
      { career: "AI/ML Engineer", overview: "Design and implement AI systems.", skillsRequired: "Math, programming, data", educationPath: "B.Tech + specialization in AI/ML", futureDemand: "Very high" },
      { career: "Data Analyst", overview: "Analyze data to support decisions.", skillsRequired: "Statistics, Excel, SQL", educationPath: "B.Sc/B.Tech in Maths/Stats/CS", futureDemand: "High" },
      { career: "Robotics Engineer", overview: "Design and build robots.", skillsRequired: "Mechanics, electronics, programming", educationPath: "B.Tech in Robotics/Mechanical", futureDemand: "Growing" },
      { career: "Product Manager", overview: "Lead product strategy and development.", skillsRequired: "Communication, analytics", educationPath: "Any degree + MBA or experience", futureDemand: "High" },
    ];
    const alternateCareers: CareerRecommendationDetail[] = [
      { career: "Technical Writer", overview: "Create technical documentation.", skillsRequired: "Writing, technical understanding", educationPath: "English/Journalism + domain knowledge", futureDemand: "Stable" },
      { career: "EdTech Specialist", overview: "Design and support educational technology.", skillsRequired: "Teaching, technology", educationPath: "Education + tech skills", futureDemand: "Growing" },
      { career: "Research Scientist", overview: "Conduct research in science or engineering.", skillsRequired: "Research methods, analysis", educationPath: "M.Sc/Ph.D. in relevant field", futureDemand: "Stable" },
    ];
    const skillDevelopmentSuggestions = [
      "Build projects in your area of interest (coding, design, or experiments).",
      "Take online courses in programming or data analysis.",
      "Participate in science fairs or hackathons.",
    ];
    if (text) {
      try {
        const topBlock = text.match(/TOP:\s*([\s\S]*?)(?=ALT:|$)/i)?.[1];
        const altBlock = text.match(/ALT:\s*([\s\S]*?)(?=SUMMARY:|$)/i)?.[1];
        const summaryMatch = text.match(/SUMMARY:\s*([^\n]+)/i);
        const skillsMatch = text.match(/SKILLS:\s*([^\n]+)/i);
        const parseCareers = (block: string | undefined, max: number): CareerRecommendationDetail[] => {
          if (!block) return [];
          const parts = block.split(";").map((s) => s.trim()).filter(Boolean).slice(0, max);
          return parts.map((p) => {
            const [career, overview, skillsRequired, educationPath, futureDemand] = p.split("|").map((s) => s.trim());
            return { career: career || "Career", overview, skillsRequired, educationPath, futureDemand };
          }).filter((c) => c.career);
        };
        if (topBlock) {
          const parsed = parseCareers(topBlock, 5);
          if (parsed.length) topCareers.splice(0, parsed.length, ...parsed);
        }
        if (altBlock) {
          const parsed = parseCareers(altBlock, 3);
          if (parsed.length) alternateCareers.splice(0, parsed.length, ...parsed);
        }
        if (summaryMatch) summaryMatch[1] && (skillDevelopmentSuggestions.length === 3); // use for summary below
        if (skillsMatch) {
          const list = skillsMatch[1].split(";").map((s) => s.trim()).filter(Boolean);
          if (list.length) skillDevelopmentSuggestions.splice(0, list.length, ...list);
        }
      } catch (_) {}
    }
    const summary = (text && text.includes("SUMMARY:"))
      ? (text.match(/SUMMARY:\s*([^\n]+)/i)?.[1]?.trim() ?? "CareerBuddy assessment complete. Consider exploring STEM and technology streams.")
      : "CareerBuddy assessment complete. Consider exploring STEM and technology streams.";
    return {
      topCareers,
      alternateCareers,
      summary,
      skillDevelopmentSuggestions,
    };
  },

  async generateStreamRecommendation(
    profile: CareerProfile,
    _responses: AssessmentResponse[]
  ): Promise<StreamRecommendationResult> {
    const subs = profile.favoriteSubjects.map((s) => s.toLowerCase());
    const grade = profile.student?.grade ?? 10;
    let recommended = "Humanities";
    const alternateStreams: string[] = [];
    if (subs.some((s) => ["math", "mathematics", "physics", "chemistry"].some((t) => s.includes(t)))) {
      recommended = "MPC";
      alternateStreams.push("MPC + Computer Science", "MPC + Electronics");
    } else if (subs.some((s) => ["biology", "chemistry"].some((t) => s.includes(t)))) {
      recommended = "PCB";
      alternateStreams.push("PCB + Computer Science");
    } else if (subs.some((s) => ["commerce", "account", "economics", "business"].some((t) => s.includes(t)))) {
      recommended = "Commerce";
      alternateStreams.push("Commerce + Maths");
    } else {
      alternateStreams.push("Humanities + Psychology", "Humanities + Political Science");
    }
    const prompt = `Student grade ${grade}. Favorite subjects: ${profile.favoriteSubjects.join(", ")}. Recommend main stream and 2 alternate streams for Indian curriculum. Format: MAIN: [stream] ALT: [stream1], [stream2]`;
    const text = await chat(prompt, undefined, 120);
    if (text) {
      const mainMatch = text.match(/MAIN:\s*([^\n,]+)/i);
      const altMatch = text.match(/ALT:\s*([^\n]+)/i);
      if (mainMatch) recommended = mainMatch[1].trim();
      if (altMatch) {
        const list = altMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
        if (list.length) alternateStreams.splice(0, list.length, ...list);
      }
    }
    return { recommended, alternateStreams };
  },

  async generateLearningInsights(_studentId: string, _grades: unknown[]): Promise<string> {
    return "Focus on consistent practice in weaker subjects. Consider peer study groups.";
  },
};

let _genai: typeof genaiAdapter | null = null;

export function getGenAI(): typeof genaiAdapter {
  if (!_genai) _genai = genaiAdapter;
  return _genai;
}
