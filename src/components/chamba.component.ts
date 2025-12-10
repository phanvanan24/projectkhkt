import { Component, signal, inject, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FileUploaderComponent } from './file-uploader.component';
import { GeminiService } from '../services/ai.service';
import { AuthService } from '../services/xacthuc.service';
import { DatabaseService } from '../services/csdl.service';
import { Chat } from '@google/genai';

declare var katex: any;

interface GradingResult {
  problemStatement: string;
  studentAnalysis: {
    stepContent: string;
    isCorrect: boolean;
    correction: string;
  }[];
  errors: string[];
  modelSolution: string;
  score: number;
  generalFeedback: string;
  improvementSuggestions: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}

interface PracticeQuestion {
  id: number;
  questionText: string;
  type: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  userAnswer?: string;
}

@Component({
  selector: 'app-math-grader',
  standalone: true,
  imports: [CommonModule, FileUploaderComponent, FormsModule],
  templateUrl: './chamba.component.html',
})
export class MathGraderComponent {
  private geminiService = inject(GeminiService);
  private dbService = inject(DatabaseService);
  private sanitizer = inject(DomSanitizer);
  public authService = inject(AuthService);

  @ViewChild('chatContainer') chatContainer!: ElementRef;

  problemImage = signal<string | null>(null);
  solutionImage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  result = signal<GradingResult | null>(null);
  error = signal<string | null>(null);

  chatSession: Chat | null = null;
  messages = signal<ChatMessage[]>([]);
  currentMessage = signal<string>('');
  isChatLoading = signal<boolean>(false);

  showPracticePrompt = signal<boolean>(false);
  isPracticeLoading = signal<boolean>(false);
  practiceQuestions = signal<PracticeQuestion[]>([]);

  hasCredits = computed(() => {
    return this.authService.laAdmin() || this.authService.creditChamBai() > 0;
  });

  canGrade = computed(() => {
    return this.problemImage() !== null && 
           this.solutionImage() !== null && 
           !this.isLoading() &&
           this.hasCredits();
  });

  onProblemImageSelected(file: {data: string, type: 'image' | 'pdf'} | null) {
    if (!file || file.type !== 'image') return;
    this.problemImage.set(file.data);
  }

  onSolutionImageSelected(file: {data: string, type: 'image' | 'pdf'} | null) {
    if (!file || file.type !== 'image') return;
    this.solutionImage.set(file.data);
  }

  async gradeAssignment() {
    if (!this.canGrade()) return;
    this.isLoading.set(true);
    this.error.set(null);
    const ok = await this.authService.consumeCredit('grader');
    if (!ok) { this.isLoading.set(false); return; }
    try {
      const res = await this.geminiService.gradeMathAssignment(this.problemImage()!, this.solutionImage()!);
      this.result.set(res);
      this.dbService.incrementStat('papersGraded');
      this.showPracticePrompt.set((res.score || 0) < 7);
    } catch (e: any) {
      this.error.set('Không thể chấm bài. Vui lòng thử lại.');
    } finally {
      this.isLoading.set(false);
    }
  }

  reset() {
    this.result.set(null);
    this.problemImage.set(null);
    this.solutionImage.set(null);
    this.messages.set([]);
    this.currentMessage.set('');
  }

  renderMath(text: string): SafeHtml {
    if (!text) return '';
    const str = String(text);
    let cleanText = str
      .replace(/\\\[/g, '$$$$')
      .replace(/\\\]/g, '$$$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$');
    const regex = /(\$\$[^]*?\$\$|\$[^\$]*?\$)/g;
    const parts = cleanText.split(regex);
    const processedParts = parts.map(part => {
      if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
        const tex = part.slice(2, -2);
        try {
          return typeof katex !== 'undefined'
            ? katex.renderToString(tex, { displayMode: true, throwOnError: false, output: 'html' })
            : part;
        } catch { return part; }
      }
      else if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
        const tex = part.slice(1, -1);
        try {
          return typeof katex !== 'undefined'
            ? katex.renderToString(tex, { displayMode: false, throwOnError: false, output: 'html' })
            : part;
        } catch { return part; }
      }
      else {
        return part
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');
      }
    });
    return this.sanitizer.bypassSecurityTrustHtml(processedParts.join(''));
  }

  formatSolution(text: string) {
    return this.renderMath(text);
  }

  async startPractice() {
    if (this.isPracticeLoading()) return;
    this.isPracticeLoading.set(true);
    try {
      const gen = await this.geminiService.generatePracticeSet(this.result()!.problemStatement || '');
      this.practiceQuestions.set(gen.questions || []);
    } catch {}
    this.isPracticeLoading.set(false);
  }

  isPracticeCorrect(q: PracticeQuestion, opt: string) {
    return q.correctAnswer === opt;
  }

  checkPracticeAnswer(q: PracticeQuestion, opt: string) {
    if (q.userAnswer) return;
    q.userAnswer = opt;
  }

  async sendMessage() {
    const text = this.currentMessage().trim();
    if (!text) return;
    const newMsgs = [...this.messages()];
    newMsgs.push({ role: 'user', text });
    this.messages.set(newMsgs);
    this.currentMessage.set('');
  }
}
