export const cLog = (s: string) => (_: unknown) => {
  console.log(s, _);
  return _;
};
