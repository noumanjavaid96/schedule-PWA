import { Injectable, signal } from '@angular/core';
import { ScheduleItem } from '../models/schedule.model';

@Injectable({
  providedIn: 'root',
})
export class ScheduleService {
  // Initial "Foo data"
  private initialSchedule: ScheduleItem[] = [
    { id: 1, schoolName: 'Raffles Institution', topic: 'Advanced Robotics Workshop', date: this.getTodayString(), time: '10:00', status: 'Confirmed', trainer: 'John Doe' },
    { id: 2, schoolName: 'Hwa Chong Institution', topic: 'Intro to Python for Sec 1', date: this.getTodayString(), time: '14:00', status: 'Confirmed', trainer: 'Jane Smith' },
    { id: 3, schoolName: 'National Junior College', topic: 'Cybersecurity Basics', date: this.getTomorrowString(), time: '09:30', status: 'Pending', trainer: 'Alex Tan' },
    { id: 4, schoolName: 'Anglo-Chinese School (Independent)', topic: 'AI in Education Seminar', date: this.getTomorrowString(), time: '13:00', status: 'Confirmed', trainer: 'Emily Carter' },
    { id: 5, schoolName: 'Victoria School', topic: 'Web Development Crash Course', date: this.getInTwoDaysString(), time: '11:00', status: 'Cancelled', trainer: 'Michael Bay', cancellationReason: 'Trainer has a personal emergency.' },
    { id: 6, schoolName: 'Dunman High School', topic: 'Data Science with Python', date: this.getInTwoDaysString(), time: '15:00', status: 'Pending', trainer: 'Sarah Chen' },
    { id: 7, schoolName: 'Nanyang Girls\' High School', topic: 'Mobile App Design Principles', date: this.getInThreeDaysString(), time: '10:30', status: 'Confirmed', trainer: 'David Lee' },
  ];

  schedule = signal<ScheduleItem[]>(this.initialSchedule);

  private getDateString(offset: number): string {
      const aDate = new Date();
      aDate.setDate(aDate.getDate() + offset);
      return aDate.toISOString().split('T')[0];
  }

  private getTodayString(): string {
      return this.getDateString(0);
  }

  private getTomorrowString(): string {
      return this.getDateString(1);
  }

  private getInTwoDaysString(): string {
      return this.getDateString(2);
  }

    private getInThreeDaysString(): string {
      return this.getDateString(3);
  }

  getSchedule(): ScheduleItem[] {
    return this.schedule();
  }

  addScheduleItem(item: Omit<ScheduleItem, 'id'>) {
    this.schedule.update(currentSchedule => {
      const newId = currentSchedule.length > 0 ? Math.max(...currentSchedule.map(i => i.id)) + 1 : 1;
      return [...currentSchedule, { ...item, id: newId }];
    });
  }

  updateScheduleItem(updatedItem: ScheduleItem) {
    this.schedule.update(currentSchedule => 
      currentSchedule.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
  }

  deleteScheduleItem(id: number) {
    this.schedule.update(currentSchedule => 
      currentSchedule.filter(item => item.id !== id)
    );
  }
}