import { compatibleUnits, convertAmount } from '../units';
import { addDays, dayInZone, wallTimeToInstant } from '../dates';

describe('Drops quantities and civil time',()=>{
  test('new exact volume definitions and precision, without rewriting legacy conversion',()=>{
    expect(convertAmount(1,'cup','mL')).toBe(240);
    expect(convertAmount(1,'oz','mL')).toBe(29.5735295625);
    expect(convertAmount(convertAmount(0.123456789,'g','mg'),'mg','g')).toBeCloseTo(0.123456789,12);
    expect(convertAmount(1,'tbsp','tsp')).toBe(3);
    expect(compatibleUnits('capsule')).toEqual(['capsule']);
    expect(()=>convertAmount(1,'tsp','g')).toThrow('Cannot convert');
    expect(()=>convertAmount(1,'tablet','mg')).toThrow('Cannot convert');
  });
  test('rejects nonfinite and invalid calendar days',()=>{
    expect(()=>convertAmount(Infinity,'g','g')).toThrow();
    expect(()=>addDays('2026-02-30',1)).toThrow();
    expect(addDays('2024-02-28',1)).toBe('2024-02-29');
    expect(addDays('2026-03-08',1)).toBe('2026-03-09');
  });
  test('saved zone determines the day, including fractional offsets',()=>{
    expect(dayInZone('2026-10-04T02:00:00Z','America/Chicago')).toBe('2026-10-03');
    expect(wallTimeToInstant('2026-10-04T12:00','Asia/Kathmandu')).toBe('2026-10-04T06:15:00.000Z');
  });
  test('DST gap is rejected and repeated hour requires explicit offset',()=>{
    expect(()=>wallTimeToInstant('2026-03-08T02:30','America/Chicago')).toThrow('does not exist');
    expect(()=>wallTimeToInstant('2026-11-01T01:30','America/Chicago')).toThrow('occurs twice');
    expect(wallTimeToInstant('2026-11-01T01:30:00-05:00','America/Chicago')).toBe('2026-11-01T06:30:00.000Z');
    expect(wallTimeToInstant('2026-11-01T01:30:00-06:00','America/Chicago')).toBe('2026-11-01T07:30:00.000Z');
    expect(()=>wallTimeToInstant('2026-11-01T01:30:00-07:00','America/Chicago')).toThrow('offset');
    expect(wallTimeToInstant('2026-11-01T07:30:00Z','America/Chicago')).toBe('2026-11-01T07:30:00.000Z');
  });
});
