import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { ScheduleService } from '../../services/schedule.service.js';
import { McpService } from '../../services/mcp.service.js';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleComponent {
  scheduleService = inject(ScheduleService);
  mcpService = inject(McpService);
  
  schedule = this.scheduleService.schedule;
  editingReminderId = signal(null);
  reminderOptions = [15, 30, 60, 120]; // 15m, 30m, 1h, 2h
  
  // Group schedule items by date
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
    const date = new Date(dateString + 'T00:00:00'); // Ensure it's parsed as local time
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatTime(timeString) {
      const [hour, minute] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hour, 10), parseInt(minute, 10));
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  deleteItem(id) {
    if (confirm('Are you sure you want to delete this event?')) {
      this.scheduleService.deleteScheduleItem(id);
    }
  }

  toggleReminderEdit(id) {
    this.editingReminderId.update(currentId => (currentId === id ? null : id));
  }

  setReminder(item, minutes) {
    const updatedItem = { ...item, reminderMinutes: minutes };
    this.scheduleService.updateScheduleItem(updatedItem);
    this.editingReminderId.set(null); // Close the options
    this.mcpService.callTool({
      name: 'send_notification',
      arguments: { message: `Reminder set for ${item.schoolName} session.` }
    });
  }

  clearReminder(item) {
    const updatedItem = { ...item };
    delete updatedItem.reminderMinutes;
    this.scheduleService.updateScheduleItem(updatedItem);
    this.mcpService.callTool({
        name: 'send_notification',
        arguments: { message: `Reminder removed for ${item.schoolName} session.` }
    });
  }
}