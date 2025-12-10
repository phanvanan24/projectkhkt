
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './components/dangnhap.component';
import { AuthService } from './services/xacthuc.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, LoginComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  authService = inject(AuthService);
  menuNguoiDung = signal<boolean>(false);

  moDangNhap() { this.authService.modalDangNhap.set(true); }

  dongDangNhap() { this.authService.modalDangNhap.set(false); }

  chuyenMenuNguoiDung() { this.menuNguoiDung.update(v => !v); }

  dangXuat() { this.authService.dangXuat(); this.menuNguoiDung.set(false); }
}
