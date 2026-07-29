import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(react-markdown|remark-gfm|marked|vfile|vfile-message|bail|unist-|unified|is-plain-obj|trough|trim-lines|decode-named-character-reference|property-information|hast-|space-separated-tokens|comma-separated-tokens|mdast-|micromark|ccount|character-entities|escape-string-regexp|devlop|zwitch|remark-|rehype-|html-void-elements)/)',
  ],
};

export default createJestConfig(config);
