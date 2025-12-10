import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './src/app.component';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { duongdan } from './src/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(duongdan, withHashLocation())
  ]
}).catch((err) => console.error(err));
