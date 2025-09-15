import { Component, ChangeDetectionStrategy, inject, computed, signal, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ScheduleService } from '../../services/schedule.service.js';
import { McpService } from '../../services/mcp.service.js';
import { ScheduleItem } from '../../models/schedule.model.js';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleComponent implements OnInit {
  scheduleService = inject(ScheduleService);
  mcpService = inject(McpService);
  fb = inject(FormBuilder);

  @Output() actionClicked = new EventEmitter<string>();
  
  schedule = this.scheduleService.schedule;
  editingReminderId = signal(null);
  reminderOptions = [15, 30, 60, 120];

  // New state for robust scheduler
  viewMode = signal<'week' | 'list'>('week');
  currentDate = signal(new Date()); // The reference date for the week view
  isModalOpen = signal(false);
  editingSession = signal<ScheduleItem | null>(null);
  sessionForm: FormGroup;

  ngOnInit() {
    this.sessionForm = this.fb.group({
      schoolName: ['', Validators.required],
      topic: ['', Validators.required],
      date: ['', Validators.required],
      time: ['', Validators.required],
      trainer: ['', Validators.required],
      status: ['Pending', Validators.required],
      location: [''],
      notes: [''],
    });
  }
  
  // --- List View Logic ---
  groupedSchedule = computed(() => {
    const groups = {};
    const sortedSchedule = [...this.schedule()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.time.localeCompare(b.time));

    for (const item of sortedSchedule) {
      const date = this.getFormattedDate(item.date);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    }
    return Object.entries(groups);
  });
  
  getFormattedDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // --- Week View Logic ---
  weekDays = computed(() => {
    const startOfWeek = this.getStartOfWeek(this.currentDate());
    return Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      return date;
    });
  });

  weekDateRange = computed(() => {
    const days = this.weekDays();
    const start = days[0];
    const end = days[6];
    const format: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString(undefined, format)} - ${end.toLocaleDateString(undefined, format)}, ${end.getFullYear()}`;
  });

  getStartOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 0); // Adjust for Sunday start
    return new Date(d.setDate(diff));
  }

  getEventsForDay(date: Date) {
    const dateString = date.toISOString().split('T')[0];
    return this.schedule()
      .filter(item => item.date === dateString)
      .sort((a,b) => a.time.localeCompare(b.time));
  }
  
  isToday(date: Date) {
      return date.toDateString() === new Date().toDateString();
  }

  changeWeek(offset: number) {
    this.currentDate.update(d => {
      const newDate = new Date(d);
      newDate.setDate(newDate.getDate() + offset * 7);
      return newDate;
    });
  }

  goToToday() {
    this.currentDate.set(new Date());
  }

  // --- Shared Logic ---
  formatTime(timeString) {
      const [hour, minute] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hour, 10), parseInt(minute, 10));
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  deleteItem(id: number) {
    if (confirm('Are you sure you want to delete this session?')) {
      this.scheduleService.deleteScheduleItem(id);
    }
  }

  toggleReminderEdit(id) {
    this.editingReminderId.update(currentId => (currentId === id ? null : id));
  }

  setReminder(item: ScheduleItem, minutes: number) {
    const updatedItem = { ...item, reminderMinutes: minutes };
    this.scheduleService.updateScheduleItem(updatedItem);
    this.editingReminderId.set(null);
    this.mcpService.sendNotification(`Reminder set for ${item.schoolName} session.`);
  }

  clearReminder(item: ScheduleItem) {
    const updatedItem = { ...item };
    delete updatedItem.reminderMinutes;
    this.scheduleService.updateScheduleItem(updatedItem);
    this.mcpService.sendNotification(`Reminder removed for ${item.schoolName} session.`);
  }

  onActionClick(actionText: string) {
    this.actionClicked.emit(actionText);
  }

  // --- Modal & Form Logic ---
  openModal(session: ScheduleItem | null = null) {
    this.editingSession.set(session);
    if (session) {
      this.sessionForm.patchValue(session);
    } else {
      this.sessionForm.reset({ status: 'Pending', date: new Date().toISOString().split('T')[0] });
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingSession.set(null);
    this.sessionForm.reset();
  }

  saveSession() {
    if (this.sessionForm.invalid) {
      this.sessionForm.markAllAsTouched();
      return;
    }

    const formValue = this.sessionForm.value;
    const sessionToSave = { ...this.editingSession(), ...formValue };

    if (this.editingSession()) {
      this.scheduleService.updateScheduleItem(sessionToSave);
    } else {
      this.scheduleService.addScheduleItem(sessionToSave);
    }
    this.closeModal();
  }
}