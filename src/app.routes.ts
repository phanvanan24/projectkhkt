
import { Routes, CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './services/xacthuc.service';
import { HomeComponent } from './components/trangchu.component';
import { MathGraderComponent } from './components/chamba.component';
import { ExamGeneratorComponent } from './components/sinhde.component';
import { MockExamComponent } from './components/thithu.component';
import { UtilitiesComponent } from './components/tienich.component';
import { TermsComponent } from './components/dieukhoan.component';
import { AdminDashboardComponent } from './components/quanly.component';

const baoveDangNhap: CanActivateFn = async (route, state) => {
  const dichVuXacThuc = inject(AuthService);
  const daXacThuc = await dichVuXacThuc.daXacThuc();

  if (daXacThuc) {
    return true;
  } else {
    dichVuXacThuc.modalDangNhap.set(true);
    return false;
  }
};

export const duongdan: Routes = [
  { path: '', component: HomeComponent },
  { path: 'grader', component: MathGraderComponent, canActivate: [baoveDangNhap] },
  { path: 'exam', component: ExamGeneratorComponent, canActivate: [baoveDangNhap] },
  { path: 'mock-exam', component: MockExamComponent, canActivate: [baoveDangNhap] },
  { path: 'utils', component: UtilitiesComponent, canActivate: [baoveDangNhap] },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [baoveDangNhap] },
  { path: 'terms', component: TermsComponent },
  { path: '**', redirectTo: '' }
];
