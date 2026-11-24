/** Pruebas de integración contra PostgreSQL real (base transporte_test). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.e2e-spec.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  globalSetup: './global-setup.ts',
  setupFiles: ['./setup-env.ts'],
  testTimeout: 30000,
};
