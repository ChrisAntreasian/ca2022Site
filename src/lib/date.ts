export const daysFromNow = (d: number) =>
  new Date(new Date().getTime() + d * 24 * 60 * 60 * 1000);
