import { BadRequestException } from '@nestjs/common';
import { ParseDatePipe } from './parse-date.pipe';

describe('ParseDatePipe', () => {
  let pipe: ParseDatePipe;

  beforeEach(() => {
    pipe = new ParseDatePipe();
  });

  describe('valid dates', () => {
    it('should accept valid YYYY-MM-DD format', () => {
      expect(pipe.transform('2024-01-15')).toBe('2024-01-15');
    });

    it('should accept first day of month', () => {
      expect(pipe.transform('2024-01-01')).toBe('2024-01-01');
    });

    it('should accept last day of month', () => {
      expect(pipe.transform('2024-01-31')).toBe('2024-01-31');
    });

    it('should accept leap year Feb 29', () => {
      expect(pipe.transform('2024-02-29')).toBe('2024-02-29');
    });

    it('should accept Dec 31', () => {
      expect(pipe.transform('2024-12-31')).toBe('2024-12-31');
    });
  });

  describe('invalid format', () => {
    it('should reject DD-MM-YYYY format', () => {
      expect(() => pipe.transform('15-01-2024')).toThrow(BadRequestException);
      expect(() => pipe.transform('15-01-2024')).toThrow(
        'Invalid date format. Expected YYYY-MM-DD',
      );
    });

    it('should reject MM/DD/YYYY format', () => {
      expect(() => pipe.transform('01/15/2024')).toThrow(BadRequestException);
    });

    it('should reject date without leading zeros', () => {
      expect(() => pipe.transform('2024-1-15')).toThrow(BadRequestException);
    });

    it('should reject datetime strings', () => {
      expect(() => pipe.transform('2024-01-15T00:00:00')).toThrow(
        BadRequestException,
      );
    });

    it('should reject ISO strings with timezone', () => {
      expect(() => pipe.transform('2024-01-15T00:00:00.000Z')).toThrow(
        BadRequestException,
      );
    });

    it('should reject arbitrary strings', () => {
      expect(() => pipe.transform('not-a-date')).toThrow(BadRequestException);
    });

    it('should reject empty string', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
    });
  });

  describe('invalid dates', () => {
    it('should reject Feb 30', () => {
      expect(() => pipe.transform('2024-02-30')).toThrow(BadRequestException);
      expect(() => pipe.transform('2024-02-30')).toThrow('Invalid date');
    });

    it('should reject Feb 29 in non-leap year', () => {
      expect(() => pipe.transform('2023-02-29')).toThrow(BadRequestException);
    });

    it('should reject month 13', () => {
      expect(() => pipe.transform('2024-13-01')).toThrow(BadRequestException);
    });

    it('should reject month 00', () => {
      expect(() => pipe.transform('2024-00-15')).toThrow(BadRequestException);
    });

    it('should reject day 00', () => {
      expect(() => pipe.transform('2024-01-00')).toThrow(BadRequestException);
    });

    it('should reject day 32', () => {
      expect(() => pipe.transform('2024-01-32')).toThrow(BadRequestException);
    });

    it('should reject April 31', () => {
      expect(() => pipe.transform('2024-04-31')).toThrow(BadRequestException);
    });
  });

  describe('year range validation', () => {
    it('should accept year 1900', () => {
      expect(pipe.transform('1900-01-01')).toBe('1900-01-01');
    });

    it('should accept year 2100', () => {
      expect(pipe.transform('2100-12-31')).toBe('2100-12-31');
    });

    it('should reject year before 1900', () => {
      expect(() => pipe.transform('1899-12-31')).toThrow(BadRequestException);
      expect(() => pipe.transform('1899-12-31')).toThrow(
        'Year must be between 1900 and 2100',
      );
    });

    it('should reject year after 2100', () => {
      expect(() => pipe.transform('2101-01-01')).toThrow(BadRequestException);
      expect(() => pipe.transform('2101-01-01')).toThrow(
        'Year must be between 1900 and 2100',
      );
    });
  });
});
