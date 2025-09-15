import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ChatCommsService {
  messageToSend = signal<string | null>(null);
}