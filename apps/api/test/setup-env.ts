// Variables de entorno para las pruebas e2e (base de datos separada).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://transporte:transporte@localhost:5432/transporte_test';
process.env.JWT_ACCESS_SECRET = 'secreto-de-pruebas-secreto-de-pruebas-1234';
process.env.THROTTLE_ENABLED = 'false';
process.env.MAIL_PROVIDER = 'console';
process.env.WEB_APP_URL = 'http://localhost:3001';
