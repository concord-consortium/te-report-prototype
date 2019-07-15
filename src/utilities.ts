import { serverName, serverShortName, verbose } from './globals';
import { IEvent, ISession } from './report-data-types';

// Handy date comparators.
// =======================

export function eventDateCompare(e1: IEvent, e2: IEvent): number {
  // Returns the millisecond difference of two events.
  return (e1.eventDate.getTime() - e2.eventDate.getTime());
}

export function sessionFirstDateCompare(s1: ISession, s2: ISession): number {
  // Returns the millisecond difference between two session start dates.
  return (s1.firstDate.getTime() - s2.firstDate.getTime());
}

// General helper methods.
// =======================

export async function asyncForEach(array: any, callback: any): Promise<void> {
  // This is handy for when one would normally use a forEach to do some
  // processing on an array of items; but, can't use forEach since it doesn't
  // work in the case of async/await function calls to the callback function.
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

export function isBlank(s: string): boolean {
  return (s === null || s === undefined || s === '');
}

// Status reporting, debugging messages and dump-file methods.
// ===========================================================

export function announce(s: string): void {
  // Always write to the console, with the long name of the server.
  console.log(`${serverName} - ${s}`);
}

export function warn(s: string): void {
  // Always write to the console, using short server name and "WARNING" preamble.
  console.log(`${serverShortName} - WARNING: ${s}`);
}

export function info(label: string, s: string): void {
  // Only writes to the console if enabled with the verbose flag.
  if (verbose) {
    console.log(`${serverShortName}::${label} - ${s}`);
  }
}
