import { mkKeyWDefault } from '../src/lib/file.js';

// Test edge cases
const testCases = [
  'routes/landing',
  '/routes/landing/data'
];

testCases.forEach(testCase => {
  console.log(`'${testCase}' -> '${mkKeyWDefault(testCase)}'`);
});
