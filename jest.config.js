export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  moduleNameMapper: {
    "@bintoca/(.*)": '<rootDir>/$1'
  },
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  testPathIgnorePatterns: [
    'half.test.ts',
    '<rootDir>/cbor/',
    '<rootDir>/dev/',
    '<rootDir>/http/',
    '<rootDir>/package/',
  ]
};