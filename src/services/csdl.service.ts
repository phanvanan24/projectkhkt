import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  Timestamp,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  where,
  limit
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA48GcL6K3bt0ywuD8LU3XdE9LKXOTqitg",
  authDomain: "thithu-c66eb.firebaseapp.com",
  projectId: "thithu-c66eb",
  storageBucket: "thithu-c66eb.firebasestorage.app",
  messagingSenderId: "11672956754",
  appId: "1:11672956754:web:01842953bd9e549f0fd48b",
  measurementId: "G-XC9G6JPNEE"
};

export interface ExamRecord {
  id?: string;
  title: string;
  subjectId: string;
  duration: string;
  structure: {
    abcd: number;
    tf: number;
    short: number;
  };
  tags: string[];
  questions: any[];
  pdfBase64?: string;
  hasPdf?: boolean;
  participants: number;
  createdAt: any;
}

export interface SystemStats {
  examsCreated: number;
  papersGraded: number;
  studentsRegistered: number;
}

export interface ExamHistoryItem {
  id?: string;
  userId: string;
  title: string;
  examData: any;
  createdAt: any;
}

export interface ChatHistoryMsg {
  role: 'user' | 'model';
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private app = getApps().some(app => app.name === 'MockExamApp') 
    ? getApp('MockExamApp') 
    : initializeApp(firebaseConfig, 'MockExamApp');

  private db = getFirestore(this.app);
  
  private EXAMS_COL = 'exams';
  private HISTORY_COL = 'exam_history';
  private STATS_DOC = 'stats/system_v2';
  private CHAT_HISTORY_COL = 'chat_histories';
  
  private CONFIG_GLOBAL_DOC = 'system_config/global'; 
  private CONFIG_PROMPTS_DOC = 'system_config/prompts'; 
  private EXAMPLES_COL = 'exam_examples';

  constructor() {}

  async getSystemConfig() {
    try {
      const docRef = doc(this.db, this.CONFIG_GLOBAL_DOC);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async saveSystemConfig(data: { apiKey?: string }) {
    try {
      const docRef = doc(this.db, this.CONFIG_GLOBAL_DOC);
      await setDoc(docRef, data, { merge: true });
      return true;
    } catch (e) {
      return false;
    }
  }

  async getPromptsConfig() {
    try {
      const docRef = doc(this.db, this.CONFIG_PROMPTS_DOC);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
      return {};
    } catch (e) {
      return {};
    }
  }

  async savePromptsConfig(promptsMap: Record<string, string>) {
    try {
      const docRef = doc(this.db, this.CONFIG_PROMPTS_DOC);
      await setDoc(docRef, promptsMap, { merge: true });
      return true;
    } catch (e) {
      return false;
    }
  }

  async getExampleData(subject: string, category: string, level: string, contentLesson?: string): Promise<string | null> {
    try {
      let docId = `${subject}_${category}`;
      if (contentLesson && contentLesson !== 'all') {
        docId += `_${contentLesson}`;
      }
      docId += `_${level}`;
      docId = docId.toLowerCase();

      const docRef = doc(this.db, this.EXAMPLES_COL, docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data()['content'] as string;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async saveExampleData(subject: string, category: string, level: string, content: string, lesson?: string) {
    try {
      let docId = `${subject}_${category}`;
      if (lesson && lesson !== 'all') {
        docId += `_${lesson}`;
      }
      docId += `_${level}`;
      docId = docId.toLowerCase();

      const docRef = doc(this.db, this.EXAMPLES_COL, docId);
      await setDoc(docRef, { 
        subject,
        category,
        lesson: lesson || 'all',
        level,
        content: content,
        updatedAt: Timestamp.now()
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async getMathExample(chapterId: string, levelId: string): Promise<string | null> {
    return this.getExampleData('math', chapterId, levelId);
  }

  async getSystemStats(): Promise<SystemStats> {
    try {
      const docRef = doc(this.db, this.STATS_DOC);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as SystemStats;
      } else {
        const defaults: SystemStats = {
          examsCreated: 124,
          papersGraded: 211,
          studentsRegistered: 41
        };
        await setDoc(docRef, defaults);
        return defaults;
      }
    } catch (error) {
      return { examsCreated: 124, papersGraded: 211, studentsRegistered: 41 };
    }
  }

  async incrementStat(field: 'examsCreated' | 'papersGraded' | 'studentsRegistered') {
    try {
      const docRef = doc(this.db, this.STATS_DOC);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          examsCreated: 124,
          papersGraded: 211,
          studentsRegistered: 41
        });
      }
      
      await updateDoc(docRef, {
        [field]: increment(1)
      });
    } catch (error) {
    }
  }

  async addExam(exam: ExamRecord) {
    try {
      const pdfData = exam.pdfBase64;
      const examToSave = { ...exam };
      delete examToSave.pdfBase64;
      examToSave.hasPdf = !!pdfData;

      const colRef = collection(this.db, this.EXAMS_COL);
      const docRef = await addDoc(colRef, {
        ...examToSave,
        createdAt: Timestamp.now(),
        participants: 0
      });

      if (pdfData) {
        const CHUNK_SIZE = 500 * 1024;
        const totalChunks = Math.ceil(pdfData.length / CHUNK_SIZE);
        const partsCol = collection(this.db, this.EXAMS_COL, docRef.id, 'pdf_parts');
        
        const promises = [];
        for (let i = 0; i < totalChunks; i++) {
          const chunk = pdfData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const partDoc = doc(partsCol, i.toString()); 
          promises.push(setDoc(partDoc, { data: chunk, index: i }));
        }
        await Promise.all(promises);
      }

      return { success: true, id: docRef.id };
    } catch (error) {
      return { success: false, error };
    }
  }

  async getExams(): Promise<ExamRecord[]> {
    try {
      const colRef = collection(this.db, this.EXAMS_COL);
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ExamRecord));
    } catch (error) {
      return [];
    }
  }

  async getExamPdf(examId: string): Promise<string | null> {
    try {
      const partsCol = collection(this.db, this.EXAMS_COL, examId, 'pdf_parts');
      const snapshot = await getDocs(partsCol);
      
      if (snapshot.empty) return null;

      const parts = snapshot.docs.map(doc => doc.data() as { data: string, index: number });
      parts.sort((a, b) => a.index - b.index);
      
      return parts.map(p => p.data).join('');
    } catch (error) {
      return null;
    }
  }

  async deleteExam(id: string) {
    try {
      await deleteDoc(doc(this.db, this.EXAMS_COL, id));
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }

  async saveExamHistory(userId: string, examData: any) {
    try {
      const colRef = collection(this.db, this.HISTORY_COL);
      const q = query(colRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      const historyDocs = snapshot.docs.sort((a, b) => {
         const tA = a.data()['createdAt']?.seconds || 0;
         const tB = b.data()['createdAt']?.seconds || 0;
         return tA - tB;
      });
      
      if (historyDocs.length >= 5) {
        const deleteCount = historyDocs.length - 4; 
        for (let i = 0; i < deleteCount; i++) {
           await deleteDoc(historyDocs[i].ref);
        }
      }

      await addDoc(colRef, {
        userId: userId,
        title: examData.title || 'Đề thi không tên',
        examData: JSON.stringify(examData),
        createdAt: Timestamp.now()
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async getUserExamHistory(userId: string): Promise<ExamHistoryItem[]> {
    try {
      const colRef = collection(this.db, this.HISTORY_COL);
      const q = query(colRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      const sortedDocs = snapshot.docs.sort((a, b) => {
         const tA = a.data()['createdAt']?.seconds || 0;
         const tB = b.data()['createdAt']?.seconds || 0;
         return tB - tA;
      });
      
      return sortedDocs.map(doc => {
        const data = doc.data();
        let parsedData = null;
        try {
           parsedData = JSON.parse(data['examData']);
        } catch(e) { parsedData = {}; }

        return {
          id: doc.id,
          userId: data['userId'],
          title: data['title'],
          examData: parsedData,
          createdAt: data['createdAt']
        } as ExamHistoryItem;
      });
    } catch (error) {
      return [];
    }
  }

  async getTeacherChatHistory(userId: string): Promise<ChatHistoryMsg[]> {
    try {
      const docRef = doc(this.db, this.CHAT_HISTORY_COL, userId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return data['messages'] || [];
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  async saveTeacherChatHistory(userId: string, messages: ChatHistoryMsg[]) {
    try {
      const docRef = doc(this.db, this.CHAT_HISTORY_COL, userId);
      await setDoc(docRef, {
        messages: messages,
        updatedAt: Timestamp.now()
      }, { merge: true });
    } catch (e) {
    }
  }
}
