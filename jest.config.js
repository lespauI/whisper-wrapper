module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests', '<rootDir>/src'],
    testMatch: [
        '**/tests/**/*.test.js',
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/main/index.js',
        '!src/renderer/index.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/'
    ]
};