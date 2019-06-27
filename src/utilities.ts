import { IEvent, ISession } from './build-report-data';

export function eventDateCompare(e1: IEvent, e2: IEvent): number {
  // Returns the difference in two event's dates, in milliseconds.
  return (e1.eventDate.getTime() - e2.eventDate.getTime());
}

export function sessionFirstDateCompare(s1: ISession, s2: ISession): number {
  // Returns the difference in two event's dates, in milliseconds.
  return (s1.firstDate.getTime() - s2.firstDate.getTime());
}

export async function asyncForEach(array: any, callback: any): Promise<void> {
  // This is handy for when one would normally use a forEach to do some
  // processing on an array of items; but, can't use forEach since it doesn't
  // work in the case of async/await function calls to the callback function.
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
