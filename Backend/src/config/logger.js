'use strict';

const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('./index');

const { combine, timestamp, printf, colorize, errors, json, splat } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaKeys = Object.keys(meta).filter((k) => k !== 'service');
  const metaStr = metaKeys.length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}] ${stack || message}${metaStr}`;
});

const transports = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      splat(),
      errors({ stack: true }),
      consoleFormat
    ),
  }),
];

// File rotation only when we have a writable filesystem (i.e. not on Vercel/
// Lambda serverless, where only /tmp is writable) and not during tests.
// On serverless we log to the console only — the platform captures stdout.
const canWriteFiles = !config.isTest && !config.isServerless;
if (canWriteFiles) {
  transports.push(
    new winston.transports.DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'truentry-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
      format: combine(timestamp(), errors({ stack: true }), splat(), json()),
    }),
    new winston.transports.DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'truentry-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: combine(timestamp(), errors({ stack: true }), splat(), json()),
    })
  );
}

const logger = winston.createLogger({
  level: config.isProd ? 'info' : 'debug',
  defaultMeta: { service: 'truentry-api' },
  transports,
  exitOnError: false,
});

// Stream for morgan HTTP logging.
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
