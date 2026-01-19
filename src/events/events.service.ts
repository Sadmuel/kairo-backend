import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEventDto, UpdateEventDto } from './dto';
import { Event, RecurrenceType } from '@prisma/client';
import { parseDate } from 'src/days/pipes';

export interface EventOccurrence {
  id: string;
  title: string;
  date: Date;
  color: string | null;
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  isOccurrence: boolean;
  occurrenceDate: Date;
}

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });
  }

  async findByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<EventOccurrence[]> {
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (start > end) {
      throw new BadRequestException('startDate must be less than or equal to endDate');
    }

    // Fetch all user events that could have occurrences in range
    // For non-recurring: event date must be within range
    // For recurring: event date must be <= endDate (could generate occurrences in range)
    const events = await this.prisma.event.findMany({
      where: {
        userId,
        OR: [
          // Non-recurring events within range
          {
            isRecurring: false,
            date: { gte: start, lte: end },
          },
          // Recurring events that started on or before end date
          {
            isRecurring: true,
            date: { lte: end },
          },
        ],
      },
    });

    // Generate all occurrences within the range
    const occurrences: EventOccurrence[] = [];
    for (const event of events) {
      const eventOccurrences = this.generateOccurrences(event, start, end);
      occurrences.push(...eventOccurrences);
    }

    // Sort by occurrence date
    occurrences.sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());

    return occurrences;
  }

  async findOne(id: string, userId: string): Promise<Event> {
    const event = await this.prisma.event.findFirst({
      where: { id, userId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async create(userId: string, dto: CreateEventDto): Promise<Event> {
    const isRecurring = dto.isRecurring ?? false;
    const recurrenceType = dto.recurrenceType ?? RecurrenceType.NONE;

    this.validateRecurrenceConsistency(isRecurring, recurrenceType);

    return this.prisma.event.create({
      data: {
        title: dto.title,
        date: parseDate(dto.date),
        color: dto.color ?? null,
        isRecurring,
        recurrenceType,
        userId,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id, userId);

    // Determine the final values for recurrence validation
    const isRecurring = dto.isRecurring ?? event.isRecurring;
    const recurrenceType = dto.recurrenceType ?? event.recurrenceType;

    this.validateRecurrenceConsistency(isRecurring, recurrenceType);

    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.date !== undefined && { date: parseDate(dto.date) }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.isRecurring !== undefined && { isRecurring: dto.isRecurring }),
        ...(dto.recurrenceType !== undefined && {
          recurrenceType: dto.recurrenceType,
        }),
      },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await this.prisma.event.delete({
      where: { id },
    });
  }

  private validateRecurrenceConsistency(
    isRecurring: boolean,
    recurrenceType: RecurrenceType,
  ): void {
    if (isRecurring && recurrenceType === RecurrenceType.NONE) {
      throw new BadRequestException('Recurring events must have a recurrence type other than NONE');
    }

    if (!isRecurring && recurrenceType !== RecurrenceType.NONE) {
      throw new BadRequestException('Non-recurring events must have recurrence type NONE');
    }
  }

  private generateOccurrences(event: Event, rangeStart: Date, rangeEnd: Date): EventOccurrence[] {
    const occurrences: EventOccurrence[] = [];
    const baseDate = event.date;

    if (!event.isRecurring || event.recurrenceType === RecurrenceType.NONE) {
      // Non-recurring event: return single occurrence if within range
      if (baseDate >= rangeStart && baseDate <= rangeEnd) {
        occurrences.push(this.toOccurrence(event, baseDate, false));
      }
      return occurrences;
    }

    // For WEEKDAYS and WEEKENDS, use a different approach - iterate day by day
    if (
      event.recurrenceType === RecurrenceType.WEEKDAYS ||
      event.recurrenceType === RecurrenceType.WEEKENDS
    ) {
      return this.generateWeekdayWeekendOccurrences(event, rangeStart, rangeEnd);
    }

    // For other recurring events, generate occurrences within the range
    let index = 0;
    let currentDate = this.getOccurrenceDate(baseDate, event.recurrenceType, index);

    // Fast-forward to the first occurrence that could be in range
    while (currentDate < rangeStart) {
      index++;
      currentDate = this.getOccurrenceDate(baseDate, event.recurrenceType, index);
    }

    // Generate occurrences within range
    while (currentDate <= rangeEnd) {
      occurrences.push(this.toOccurrence(event, currentDate, index > 0));
      index++;
      currentDate = this.getOccurrenceDate(baseDate, event.recurrenceType, index);
    }

    return occurrences;
  }

  private generateWeekdayWeekendOccurrences(
    event: Event,
    rangeStart: Date,
    rangeEnd: Date,
  ): EventOccurrence[] {
    const occurrences: EventOccurrence[] = [];
    const baseDate = event.date;
    const isWeekdays = event.recurrenceType === RecurrenceType.WEEKDAYS;

    // Start from the later of baseDate or rangeStart
    const startDate = baseDate > rangeStart ? new Date(baseDate) : new Date(rangeStart);

    // Iterate day by day
    const currentDate = new Date(startDate);
    let isFirstOccurrence = true;

    while (currentDate <= rangeEnd) {
      const dayOfWeek = currentDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isWeekday = !isWeekend;

      const shouldInclude = isWeekdays ? isWeekday : isWeekend;

      if (shouldInclude) {
        // Check if this is the original event date
        const isOriginal = currentDate.getTime() === baseDate.getTime() && isFirstOccurrence;
        occurrences.push(this.toOccurrence(event, new Date(currentDate), !isOriginal));
        if (isOriginal) isFirstOccurrence = false;
      }

      // Move to next day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return occurrences;
  }

  private getOccurrenceDate(
    baseDate: Date,
    recurrenceType: RecurrenceType,
    occurrenceIndex: number,
  ): Date {
    const result = new Date(baseDate);

    switch (recurrenceType) {
      case RecurrenceType.DAILY:
        result.setUTCDate(result.getUTCDate() + occurrenceIndex);
        break;

      case RecurrenceType.WEEKLY:
        result.setUTCDate(result.getUTCDate() + occurrenceIndex * 7);
        break;

      case RecurrenceType.MONTHLY: {
        // Handle last-day-of-month edge case
        // If base date is 31st and target month has fewer days, use last day
        const originalDay = baseDate.getUTCDate();
        result.setUTCMonth(result.getUTCMonth() + occurrenceIndex);

        // Check if the day overflowed (e.g., Jan 31 + 1 month = Mar 3)
        // If so, go back to last day of intended month
        if (result.getUTCDate() !== originalDay) {
          // Day overflowed, set to last day of previous month
          result.setUTCDate(0);
        }
        break;
      }

      case RecurrenceType.YEARLY: {
        // Handle Feb 29 on non-leap years (becomes Feb 28)
        const originalMonth = baseDate.getUTCMonth();
        const originalDayOfMonth = baseDate.getUTCDate();
        result.setUTCFullYear(result.getUTCFullYear() + occurrenceIndex);

        // Check if date shifted (leap year edge case)
        if (result.getUTCMonth() !== originalMonth || result.getUTCDate() !== originalDayOfMonth) {
          // Reset to intended month and use last valid day
          result.setUTCMonth(originalMonth + 1, 0);
        }
        break;
      }

      case RecurrenceType.NONE:
        // No recurrence, return base date
        break;
    }

    return result;
  }

  private toOccurrence(event: Event, occurrenceDate: Date, isOccurrence: boolean): EventOccurrence {
    return {
      id: event.id,
      title: event.title,
      date: event.date,
      color: event.color,
      isRecurring: event.isRecurring,
      recurrenceType: event.recurrenceType,
      userId: event.userId,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      isOccurrence,
      occurrenceDate,
    };
  }
}
