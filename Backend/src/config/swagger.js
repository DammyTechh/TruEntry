'use strict';

const path = require('path');
const fs = require('fs');
const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./index');

/**
 * OpenAPI definition. Reusable schemas and security schemes live here; the
 * per-route documentation lives in src/docs/*.docs.js (kept out of the route
 * files deliberately, per the project's docs-in-a-separate-folder convention).
 */
const definition = {
  openapi: '3.0.3',
  info: {
    title: 'TruEntry API',
    version: '1.0.0',
    description:
      'TruEntry — Tertiary Education Admissions Quality Assurance Platform. ' +
      'Digitalizes, secures and automates the Nigerian tertiary admissions pipeline: ' +
      'applicant onboarding (NIN/JAMB/O-Level verification), institution decisioning, ' +
      'registrar approval, JAMB regulatory audit, payments and reporting.',
    contact: { name: 'TruEntry Support', email: config.mail.supportEmail },
  },
  servers: [
    { url: `${config.urls.backend}${config.apiPrefix}`, description: 'Current environment' },
    { url: `http://localhost:${config.port}${config.apiPrefix}`, description: 'Local' },
  ],
  tags: [
    { name: 'Health', description: 'Service liveness and dependency status' },
    { name: 'Auth', description: 'Registration, login, tokens, password management' },
    { name: 'Profile', description: 'Applicant onboarding and identity verification' },
    { name: 'Institutions', description: 'Institutions, categories, departments, parameters' },
    { name: 'Policies', description: 'Admission policy statements' },
    { name: 'Applications', description: 'Application lifecycle for applicants and institution staff' },
    { name: 'Decision', description: 'Quota-aware ranking and selection' },
    { name: 'Payments', description: 'Paystack application-fee payments' },
    { name: 'Admission Letters', description: 'Admission letter generation and download' },
    { name: 'Reports', description: 'Audit-ready admission reports' },
    { name: 'JAMB', description: 'Regulatory audit and final admission' },
    { name: 'Chatbot', description: 'AI assistant and human escalation' },
    { name: 'Notifications', description: 'In-app notifications' },
    { name: 'Admin', description: 'System administration, users, finances, audit, mock data' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'refresh_token' },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'object', nullable: true },
          meta: { type: 'object', nullable: true },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Resource not found' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              details: { type: 'object', nullable: true },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 42 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 3 },
          hasNext: { type: 'boolean' },
          hasPrev: { type: 'boolean' },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'string', example: '15m' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          role: { type: 'string', enum: ['applicant', 'officer', 'registrar', 'jamb', 'admin'] },
          institutionId: { type: 'string', format: 'uuid', nullable: true },
          isEmailVerified: { type: 'boolean' },
          isActive: { type: 'boolean' },
        },
      },
      Application: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          reference: { type: 'string', example: 'TRU-APP-XXXX' },
          institutionName: { type: 'string' },
          departmentName: { type: 'string' },
          jambScore: { type: 'number', nullable: true },
          postUtmeScore: { type: 'number', nullable: true },
          aggregateScore: { type: 'number', nullable: true },
          status: {
            type: 'string',
            enum: [
              'draft', 'pending_payment', 'submitted', 'under_review',
              'qualified_post_utme', 'not_qualified_post_utme', 'post_utme_completed',
              'recommended', 'approved', 'rejected', 'forwarded_jamb', 'admitted', 'not_admitted',
            ],
          },
          paymentStatus: { type: 'string', enum: ['pending', 'success', 'failed', 'abandoned', 'refunded'] },
          rank: { type: 'integer', nullable: true },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Missing or invalid authentication',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
      Forbidden: {
        description: 'Authenticated but not permitted',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
      ValidationError: {
        description: 'Request validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

// Resolve the per-route documentation files explicitly. We read the directory
// and pass absolute, FORWARD-SLASH paths — swagger-jsdoc globs each entry, and
// glob treats backslashes as escape characters, so a Windows-style path from
// path.join() ("...\\src\\docs\\*.docs.js") silently matches nothing and the
// UI renders tags with no operations. Forward slashes work on Windows and POSIX.
const toPosix = (p) => p.replace(/\\/g, '/');
const docsDir = path.join(__dirname, '..', 'docs');
let docApis;
try {
  docApis = fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith('.docs.js'))
    .map((f) => toPosix(path.join(docsDir, f)));
} catch (err) {
  docApis = [];
}
// Fallback to a forward-slash glob if the directory read yielded nothing.
if (!docApis.length) {
  docApis = [toPosix(path.join(docsDir, '*.docs.js'))];
}

const options = {
  definition,
  apis: docApis,
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec };
