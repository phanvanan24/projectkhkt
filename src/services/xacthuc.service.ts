import { Injectable, signal, computed, inject } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { DatabaseService } from './csdl.service';

const firebaseConfig = {
  apiKey: "AIzaSyA48GcL6K3bt0ywuD8LU3XdE9LKXOTqitg",
  authDomain: "thithu-c66eb.firebaseapp.com",
  projectId: "thithu-c66eb",
  storageBucket: "thithu-c66eb.firebasestorage.app",
  messagingSenderId: "11672956754",
  appId: "1:11672956754:web:01842953bd9e549f0fd48b",
  measurementId: "G-XC9G6JPNEE"
};

export interface DuLieuDangKy {
  email: string;
  pass: string;
  fullName: string;
  username: string;
  className: string;
  school: string;
  province: string;
}

interface TinChiNguoiDung {
  grader: number;
  generator: number;
  lastReset: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private app = initializeApp(firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);
  private dbService = inject(DatabaseService);

  nguoiDungHienTai = signal<User | null>(null);
  dangTai = signal<boolean>(true);
  
  modalDangNhap = signal<boolean>(false);
  
  creditChamBai = signal<number>(0);
  creditTaoDe = signal<number>(0);
  
  laAdmin = computed(() => {
    const user = this.nguoiDungHienTai();
    return user?.email === 'admin@limva.edu.vn';
  });

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      this.nguoiDungHienTai.set(user);
      
      if (user) {
        if (user.email === 'admin@limva.edu.vn') {
           this.creditChamBai.set(9999);
           this.creditTaoDe.set(9999);
           this.dangTai.set(false);
           return; 
        }

        await this.checkAndResetCredits(user.uid);
      } else {
        this.creditChamBai.set(0);
        this.creditTaoDe.set(0);
      }
      this.dangTai.set(false);
    });
  }

  daXacThuc(): Promise<boolean> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        unsubscribe();
        resolve(!!user);
      });
    });
  }

  private async checkAndResetCredits(uid: string) {
    const todayStr = new Date().toDateString();
    const defaultCredits = { grader: 30, generator: 30, lastReset: new Date().toISOString() };

    try {
      const userDocRef = doc(this.db, 'users', uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as TinChiNguoiDung;
        const lastResetDate = new Date(data.lastReset).toDateString();

        if (lastResetDate !== todayStr) {
          await updateDoc(userDocRef, defaultCredits);
          this.creditChamBai.set(30);
          this.creditTaoDe.set(30);
        } else {
          this.creditChamBai.set(data.grader);
          this.creditTaoDe.set(data.generator);
        }
      } else {
        await setDoc(userDocRef, defaultCredits);
        this.creditChamBai.set(30);
        this.creditTaoDe.set(30);
      }
    } catch (e: any) {
      this.useLocalStorageCredits(uid, todayStr, defaultCredits);
    }
  }

  private useLocalStorageCredits(uid: string, todayStr: string, defaultCredits: any) {
    const key = `limva_credits_${uid}`;
    let data = defaultCredits;
    
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        const lastResetDate = new Date(parsed.lastReset).toDateString();
        if (lastResetDate === todayStr) {
          data = parsed;
        } else {
          localStorage.setItem(key, JSON.stringify(defaultCredits));
        }
      } else {
        localStorage.setItem(key, JSON.stringify(defaultCredits));
      }
      
      this.creditChamBai.set(data.grader);
      this.creditTaoDe.set(data.generator);
    } catch (err) {
      this.creditChamBai.set(30);
      this.creditTaoDe.set(30);
    }
  }

  async consumeCredit(type: 'grader' | 'generator'): Promise<boolean> {
    if (this.laAdmin()) return true;

    const uid = this.nguoiDungHienTai()?.uid;
    if (!uid) return false;

    const currentVal = type === 'grader' ? this.creditChamBai() : this.creditTaoDe();
    
    if (currentVal <= 0) return false;

    const newVal = currentVal - 1;
    this.updateLocalState(type, newVal);

    try {
      const userDocRef = doc(this.db, 'users', uid);
      await updateDoc(userDocRef, { [type]: newVal });
      return true;
    } catch (e) {
      try {
        const key = `limva_credits_${uid}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          data[type] = newVal;
          localStorage.setItem(key, JSON.stringify(data));
          return true;
        }
      } catch (localErr) {
      }
      return true;
    }
  }

  private updateLocalState(type: 'grader' | 'generator', newVal: number) {
    if (type === 'grader') this.creditChamBai.set(newVal);
    else this.creditTaoDe.set(newVal);
  }

  async dangNhap(email: string, pass: string) {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, pass);
      return { success: true, user: result.user };
    } catch (error: any) {
      if (email === 'admin@limva.edu.vn' && pass === 'Vanan24042008@' && 
          (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
        try {
          const newAdmin = await createUserWithEmailAndPassword(this.auth, email, pass);
          await updateProfile(newAdmin.user, { displayName: 'Administrator' });
          this.nguoiDungHienTai.set({ ...newAdmin.user, displayName: 'Administrator' });
          return { success: true, user: newAdmin.user };
        } catch (createErr: any) {
            if (createErr.code === 'auth/email-already-in-use') {
               return { success: false, error: 'Tài khoản Admin đã tồn tại nhưng sai mật khẩu.' };
            }
            return { success: false, error: 'Không thể khôi phục tài khoản Admin.' };
        }
      }

      let msg = 'Đăng nhập thất bại.';
      if (error.code === 'auth/invalid-credential') msg = 'Sai email hoặc mật khẩu.';
      if (error.code === 'auth/user-not-found') msg = 'Tài khoản không tồn tại.';
      if (error.code === 'auth/wrong-password') msg = 'Sai mật khẩu.';
      return { success: false, error: msg };
    }
  }

  async dangKy(data: DuLieuDangKy) {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, data.email, data.pass);
      
      await updateProfile(result.user, { displayName: data.fullName });
      
      this.nguoiDungHienTai.set({ ...result.user, displayName: data.fullName }); 
      
      await this.checkAndResetCredits(result.user.uid);
      
      this.dbService.incrementStat('studentsRegistered');

      return { success: true, user: result.user };
    } catch (error: any) {
      let msg = 'Đăng ký thất bại.';
      if (error.code === 'auth/email-already-in-use') msg = 'Email này đã được sử dụng.';
      if (error.code === 'auth/weak-password') msg = 'Mật khẩu phải có ít nhất 6 ký tự.';
      return { success: false, error: msg };
    }
  }

  async dangXuat() {
    await signOut(this.auth);
    this.creditChamBai.set(0);
    this.creditTaoDe.set(0);
  }
}
