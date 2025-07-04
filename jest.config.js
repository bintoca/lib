export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  moduleNameMapper: {
    "@bintoca/(.*)": '<rootDir>/$1'
  },
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {useESM: true}],
    '^.+\\.ts?$': ['ts-jest', {useESM: true}],
  },
  testPathIgnorePatterns: [
  ]
};