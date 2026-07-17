'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const morgan = require('morgan');

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
// Raw OpenAPI spec (Swagger UI fetches this).
app.get(`${config.apiPrefix}/docs.json`, (req, res) => res.json(swaggerSpec));

// Swagger UI shell. We load the UI assets from a CDN and point them at
// /docs.json instead of using swagger-ui-express's on-disk swagger-ui-dist
// files. On serverless (Vercel) those dist files are not traced into the
// function bundle, so they were being returned as text/html and the browser
// refused them ("SwaggerUIBundle is not defined"). Serving the shell ourselves
// removes any local static files to bundle, so it works identically on local
// and on Vercel. helmet's CSP is disabled above, so the CDN scripts load fine.
const SWAGGER_UI_VERSION = '5.17.14';
const docsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TruEntry API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/favicon-32x32.png" sizes="32x32" />
  <style>body { margin: 0; background: #fafafa; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '${config.apiPrefix}/docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      });
    };
  </script>
</body>
</html>`;

// Serve on both /docs and /docs/ so either URL renders (no redirect needed).
app.get([`${config.apiPrefix}/docs`, `${config.apiPrefix}/docs/`], (req, res) => {
  res.type('html').send(docsHtml);
});

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
