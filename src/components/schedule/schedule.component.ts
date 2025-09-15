
import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleService } from '../../services/schedule.service';
import { ScheduleItem } from '../../models/schedule.model';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ScheduleComponent {
  scheduleService = inject(ScheduleService);
  
  schedule = this.scheduleService.schedule;
  
  // Group schedule items by date
  groupedSchedule = computed(() => {
    const groups: { [key: string]: ScheduleItem[] } = {};
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
  
  getFormattedDate(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00'); // Ensure it's parsed as local time
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatTime(timeString: string): string {
      const [hour, minute] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hour, 10), parseInt(minute, 10));
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  deleteItem(id: number): void {
    if (confirm('Are you sure you want to delete this event?')) {
      this.scheduleService.deleteScheduleItem(id);
    }
  }
}
