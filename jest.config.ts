import type { Config } from 'jest';

const config: Config = {
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coveragePathIgnorePatterns: ['/node_modules/'],
    coverageProvider: 'v8',
    moduleDirectories: ['node_modules', 'bower_components', 'shared'],
    moduleFileExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'node'],
    moduleNameMapper: {
        '\\.(css|less|scss)$': '<rootDir>/__mocks__/styleMock.js',
        '\\.(gif|ttf|eot|svg)$': '<rootDir>/__mocks__/fileMock.js',
        'react-dom/server': '<rootDir>/__mocks__/react-dom-server.js',
        '@deriv-com/translations': '<rootDir>/__mocks__/translation.mock.js',
        '@deriv-com/ui': '<rootDir>/node_modules/@deriv-com/ui',
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    preset: 'ts-jest',
    rootDir: __dirname,
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testEnvironment: 'jsdom',
    testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': 'babel-jest',
        '^.+\\.xml$': 'jest-transform-stub',
    },
    transformIgnorePatterns: ['/node_modules/(?!@deriv-com/ui).+\\.js$'],
};

export default config;
