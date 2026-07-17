'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const logger = require('./config/logger');
const { swaggerSpec } = require('./config/swagger');
const { globalLimiter } = require('./middleware/rateLimit.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const routes = require('./routes');
const paymentController = require('./modules/payments/payment.controller');

const app = express();

app.set('trust proxy', 1);

/* ------------------------------ Security ------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: false, // Swagger UI needs relaxed CSP
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (no origin) and any configured origin.
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-paystack-signature'],
};
app.use(cors(corsOptions));

app.use(compression());
app.use(cookieParser());

/* -------------------------- Request logging ---------------------------- */
if (!config.isTest) {
  app.use(
    morgan(config.isProd ? 'combined' : 'dev', {
      stream: logger.stream,
      skip: (req) => req.path === `${config.apiPrefix}/health` || req.path === '/health',
    })
  );
}

/* --------------------- Paystack webhook (raw body) --------------------- *
 * Mounted BEFORE the JSON parser so the HMAC signature can be verified
 * against the exact bytes Paystack sent.
 */
app.post(
  `${config.apiPrefix}/payments/webhook`,
  express.raw({ type: '*/*' }),
  paymentController.webhook
);

/* ---------------------------- Body parsers ----------------------------- */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(hpp());

/* ----------------------------- Rate limit ------------------------------ */
app.use(globalLimiter);

/* ------------------------------ API docs ------------------------------- */
app.get(`${config.apiPrefix}/docs.json`, (req, res) => res.json(swaggerSpec));
app.use(
  `${config.apiPrefix}/docs`,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'TruEntry API Docs',
    swaggerOptions: { persistAuthorization: true },
  })
);

/* ------------------------------- Routes -------------------------------- */
app.get('/', (req, res) =>
  res.json({
    success: true,
    message: 'TruEntry API',
    version: '1.0.0',
    docs: `${config.apiPrefix}/docs`,
    health: `${config.apiPrefix}/health`,
  })
);
// Convenience unversioned health probe.
app.use('/health', require('./modules/health/health.routes'));

app.use(config.apiPrefix, routes);

/* ------------------------- Errors (last) ------------------------------- */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
