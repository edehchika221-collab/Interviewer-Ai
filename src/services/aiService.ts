import { GoogleGenAI, ThinkingLevel, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface InterviewState {
  jobDescription: string;
  history: { role: "user" | "model"; text: string }[];
  currentQuestionIndex: number;
}

export const generateInterviewQuestions = async (jobDescription: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Based on this job description, generate 5 relevant and challenging interview questions. 
    Job Description: ${jobDescription}
    Return the questions as a JSON array of strings.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
  });
  
  try {
    return JSON.parse(response.text || "[]") as string[];
  } catch (e) {
    console.error("Failed to parse questions", e);
    return [];
  }
};

export const getAIResponse = async (
  jobDescription: string,
  history: { role: "user" | "model"; text: string }[],
  userAnswer: string,
  currentQuestion: string
) => {
  // Extract previous answer if it exists
  const userAnswers = history.filter(h => h.role === 'user');
  const previousAnswer = userAnswers.length > 1 
    ? userAnswers[userAnswers.length - 2].text 
    : "This is the first question of the interview.";

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: `Job Description: ${jobDescription}

Interview Context:
You are a professional interviewer. 
The candidate's previous answer was: "${previousAnswer}"
The current question was: "${currentQuestion}"
The candidate's current answer is: "${userAnswer}"

Provide a brief, professional follow-up or transition to the next stage of the interview. Acknowledge their response naturally and keep the conversation realistic.` }]
      }
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });
  return response.text || "";
};

export const generateSpeech = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/wav;base64,${base64Audio}`;
  }
  return null;
};

export const evaluateInterview = async (jobDescription: string, history: { role: "user" | "model"; text: string }[]) => {
  const transcript = history.map(h => `${h.role === 'user' ? 'Candidate' : 'Interviewer'}: ${h.text}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Analyze this interview transcript based on the job description. 
    Job Description: ${jobDescription}
    Transcript:
    ${transcript}
    
    Provide a detailed evaluation including:
    1. Overall Score (0-100)
    2. Strengths
    3. Areas for improvement
    4. Specific advice for the actual interview.
    Return the evaluation in Markdown format.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });
  
  return response.text || "Evaluation failed.";
};
