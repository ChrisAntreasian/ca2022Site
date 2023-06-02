export const cLog = (s: string) => (_: any) => {
	console.log(s, _);
	return _;
}