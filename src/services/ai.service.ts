import { Injectable, inject } from '@angular/core';
import { GoogleGenAI, Type, Chat } from '@google/genai';
import { DatabaseService } from './csdl.service';
import {
  MATH_GRADING_PROMPT,
  CHAT_SYSTEM_INSTRUCTION_TEMPLATE,
  TEACHER_CHAT_INSTRUCTION,
  PRACTICE_GENERATION_PROMPT,
  getMath12Prompt,
  getLiteraturePrompt,
  getEnglishPrompt,
  getNaturalScienceInstruction,
  getSocialTechInstruction,
  MATRIX_PROMPT,
  VARIANT_EXAM_PROMPT,
  SYLLABUS_EXAM_PROMPT
} from './prompts';

export interface ExamConfig {
  grade: string;
  subject: string;
  difficulty: string;
  questionType: string;
  questionSubType?: string;
  topic: string;
  detailRequest: string;
  quantity?: number;
}

export interface MixedExamConfig {
  subject: string;
  abcdCount: number;
  tfCount: number;
  shortCount: number;
  tags: string[];
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private modelId = 'gemini-2.5-pro';
  private dbService = inject(DatabaseService);

  private cachedApiKey: string | null = null;
  private cachedPrompts: Record<string, string> = {};

  private examSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            questionText: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["MultipleChoice", "TrueFalse", "ShortAnswer", "Essay"] },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["id", "questionText", "type", "options", "correctAnswer", "explanation"]
        }
      }
    },
    required: ["title", "questions"]
  };

  constructor() {
    this.refreshConfig();
  }

  async refreshConfig() {
    const globalConfig = await this.dbService.getSystemConfig();
    if (globalConfig && globalConfig['apiKey']) {
      this.cachedApiKey = globalConfig['apiKey'];
    }

    const promptsConfig = await this.dbService.getPromptsConfig();
    this.cachedPrompts = promptsConfig || {};
  }

  private getAiInstance(): GoogleGenAI {
    let apiKey = this.cachedApiKey || '';
    try {
      if (typeof localStorage !== 'undefined') {
        const storedKey = localStorage.getItem('LIMVA_ADMIN_API_KEY');
        if (storedKey) apiKey = storedKey;
      }
    } catch {}
    try {
      if (typeof process !== 'undefined' && process.env) {
        apiKey = apiKey || process.env['API_KEY'] || '';
      }
    } catch {}
    return new GoogleGenAI({ apiKey });
  }

  async gradeMathAssignment(problemImageBase64: string, solutionImageBase64: string): Promise<any> {
    const gradingSchema = {
      type: Type.OBJECT,
      properties: {
        problemStatement: { type: Type.STRING },
        studentAnalysis: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              stepContent: { type: Type.STRING },
              isCorrect: { type: Type.BOOLEAN },
              correction: { type: Type.STRING }
            },
            required: ["stepContent", "isCorrect", "correction"]
          }
        },
        errors: { type: Type.ARRAY, items: { type: Type.STRING } },
        modelSolution: { type: Type.STRING },
        score: { type: Type.NUMBER },
        generalFeedback: { type: Type.STRING },
        improvementSuggestions: { type: Type.STRING }
      },
      required: ["problemStatement", "studentAnalysis", "errors", "modelSolution", "score", "generalFeedback", "improvementSuggestions"]
    };

    const promptText = this.cachedPrompts['grading_math'] || MATH_GRADING_PROMPT;
    const ai = this.getAiInstance();
    const response = await ai.models.generateContent({
      model: this.modelId,
      contents: [{ role: 'user', parts: [ { text: promptText }, { inlineData: { mimeType: 'image/jpeg', data: problemImageBase64 } }, { inlineData: { mimeType: 'image/jpeg', data: solutionImageBase64 } } ] }],
      config: { responseMimeType: 'application/json', responseSchema: gradingSchema, temperature: 0.4 }
    });
    const text = response.text;
    if (!text) throw new Error('No response from AI');
    return JSON.parse(text);
  }

  createChatSession(gradingContext: any): Chat {
    const systemInstruction = CHAT_SYSTEM_INSTRUCTION_TEMPLATE(gradingContext);
    const ai = this.getAiInstance();
    return ai.chats.create({ model: this.modelId, config: { systemInstruction, temperature: 0.5 } });
  }

  createTeacherChatSession(history: {role: string, parts: {text: string}[]}[] = []): Chat {
    const ai = this.getAiInstance();
    const instruction = this.cachedPrompts['chat_teacher'] || TEACHER_CHAT_INSTRUCTION;
    return ai.chats.create({ model: this.modelId, history, config: { systemInstruction: instruction, temperature: 0.6 } });
  }

  async generatePracticeSet(originalProblem: string): Promise<any> {
    const prompt = PRACTICE_GENERATION_PROMPT(originalProblem);
    return this.runExamGeneration(prompt);
  }

  async generateSubjectExam(config: ExamConfig): Promise<any> {
    const { subject, grade, difficulty, questionType, questionSubType, topic, detailRequest, quantity } = config;
    const baseContext = `\n       Bạn là giáo viên chuyên nghiệp, am hiểu chương trình Giáo dục phổ thông 2018 (SGK mới).\n       Nhiệm vụ: Tạo đề kiểm tra Lớp ${grade}.\n       Chủ đề: "${topic}".\n       Mức độ: ${difficulty}.\n       Yêu cầu thêm: "${detailRequest}".\n    `;
    let specificInstruction = '';
    const isMath = subject === 'Toán';
    const isLiterature = subject === 'Ngữ văn';
    const isEnglish = subject === 'Ngoại ngữ';
    const socialTech = ['Lịch sử', 'Địa lý', 'Giáo dục kinh tế và pháp luật', 'Tin học', 'Công nghệ'];
    const isSocialTech = socialTech.includes(subject);

    if (isMath) {
      let examplePrompt = '';
      const dbExample = await this.fetchExampleFromDB('math', topic, difficulty);
      if (dbExample) examplePrompt = dbExample; else if (grade === '12') examplePrompt = getMath12Prompt(topic, difficulty);
      const core = this.cachedPrompts['gen_math_core'];
      specificInstruction = core ? `${core}\n\n${examplePrompt}` : getNaturalScienceInstruction(subject, questionType, (quantity || 5), examplePrompt);
    } else if (isLiterature) {
      const genre = questionType;
      const dbExample = await this.fetchExampleFromDB('lit', genre, 'any');
      let coreInst = this.cachedPrompts['gen_lit_core'];
      if (!coreInst) coreInst = getLiteraturePrompt(questionType, grade);
      specificInstruction = dbExample ? `${coreInst}\n\nTHAM KHẢO NGỮ LIỆU/CẤU TRÚC SAU:\n${dbExample}` : coreInst;
    } else if (isEnglish) {
      const subType = questionSubType || '';
      const numTasks = quantity || 1;
      let cefrLevel = 'A1';
      const gradeNum = parseInt(grade, 10);
      if (!isNaN(gradeNum)) {
        if (gradeNum >= 6 && gradeNum <= 9) {
          if (difficulty === 'Dễ') cefrLevel = 'A1'; else if (difficulty === 'Trung bình') cefrLevel = 'A2'; else cefrLevel = 'B1';
        } else if (gradeNum >= 10 && gradeNum <= 12) {
          if (difficulty === 'Dễ') cefrLevel = 'A2'; else if (difficulty === 'Trung bình') cefrLevel = 'B1'; else cefrLevel = 'B2';
        }
      }
      const typeId = questionType.includes('Dạng') ? questionType.split(':')[0].trim().replace(/\s/g, '').toLowerCase() : 'general';
      const dbExample = await this.fetchExampleFromDB('eng', typeId, cefrLevel.toLowerCase());
      let coreInst = this.cachedPrompts['gen_eng_core'];
      if (!coreInst) coreInst = getEnglishPrompt(questionType, subType, cefrLevel, numTasks);
      specificInstruction = dbExample ? `${coreInst}\n\nSỬ DỤNG DỮ LIỆU MẪU SAU:\n${dbExample}` : coreInst;
    } else if (isSocialTech) {
      specificInstruction = getSocialTechInstruction(subject, questionType, quantity || 5);
    }

    const prompt = `\n      ${baseContext}\n      \n      ${specificInstruction}\n      \n      Output JSON format strictly conforming to the schema.\n    `;
    return this.runExamGeneration(prompt);
  }

  private async fetchExampleFromDB(subject: string, rawCategory: string, rawLevel: string): Promise<string | null> {
    if (subject === 'math') {
      const chapterMatch = rawCategory.match(/Chương (\d+)/i);
      const cid = chapterMatch ? `c${chapterMatch[1]}` : 'c1';
      let lid = 'medium';
      if (rawLevel === 'Dễ') lid = 'easy';
      if (rawLevel === 'Khó') lid = 'hard';
      return await this.dbService.getExampleData('math', cid, lid);
    }
    return await this.dbService.getExampleData(subject, rawCategory, rawLevel);
  }

  async runExamGeneration(prompt: string): Promise<any> {
    await this.refreshConfig();
    const ai = this.getAiInstance();
    const response = await ai.models.generateContent({
      model: this.modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', responseSchema: this.examSchema, temperature: 0.5 }
    });
    const text = response.text;
    if (!text) throw new Error('No response from AI');
    return JSON.parse(text);
  }
}
