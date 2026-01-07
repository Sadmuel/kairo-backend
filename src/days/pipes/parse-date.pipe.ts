import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Parses a YYYY-MM-DD string to a Date object at UTC midnight.
 * This ensures consistent behavior across all environments.
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00.000Z');
}

@Injectable()
export class ParseDatePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    // Check if the value matches YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }

    // Validate it's an actual valid date (not 2024-13-45)
    const date = parseDate(value);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    // Verify the parsed date matches the input (catches invalid days like Feb 30)
    const [year, month, day] = value.split('-').map(Number);
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('Invalid date');
    }

    // Validate year is within reasonable bounds
    if (year < 1900 || year > 2100) {
      throw new BadRequestException('Year must be between 1900 and 2100');
    }

    return value;
  }
}
