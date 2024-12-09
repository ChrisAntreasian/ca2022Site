export const cLog = (s: string) => (v: unknown) => {
  console.log(s, v);
  return v;
};
