'use strict';

/**
 * @swagger
 * /admin/reports/jamb-audit:
 *   get:
 *     tags: [JAMB Audit]
 *     summary: JAMB regulatory audit report (JSON preview)
 *     description: >
 *       The record JAMB requires to audit an admission exercise: every applicant
 *       with their verified credentials and scores, the regulatory category each
 *       admission was made under, the institution's stated criteria, and a
 *       compliance comparison between the admissions actually made and the
 *       mandated National Merit (45%) / Catchment (35%) / ELDS (20%) allocation.
 *
 *
 *       The preview caps applicant rows at 100 (`truncated: true` when more
 *       exist); the export carries the complete record set.
 *     parameters:
 *       - { in: query, name: institutionId, schema: { type: string, format: uuid } }
 *       - { in: query, name: quotaId,       schema: { type: string, format: uuid } }
 *       - { in: query, name: status,        schema: { type: string, example: admitted } }
 *       - { in: query, name: from,          schema: { type: string, format: date } }
 *       - { in: query, name: to,            schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: Audit report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalApplications: { type: integer }
 *                         verified:          { type: integer, description: JAMB and O'Level both confirmed }
 *                         admitted:          { type: integer }
 *                         jambCutoff:        { type: number, nullable: true }
 *                         admissionRule:     { type: string, nullable: true }
 *                         statusCounts:      { type: object, additionalProperties: { type: integer } }
 *                         compliance:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:    { type: string, example: Catchment Area }
 *                               mandatedPct: { type: number, example: 35 }
 *                               admitted:    { type: integer }
 *                               actualPct:   { type: number }
 *                               variancePct: { type: number, description: Actual minus mandated }
 *                     applicants: { type: array, items: { type: object } }
 *                     truncated:  { type: boolean }
 *
 * /admin/reports/jamb-audit/export:
 *   get:
 *     tags: [JAMB Audit]
 *     summary: Download the audit report as PDF or Excel
 *     description: >
 *       Returns a binary attachment of the complete record set.
 *
 *
 *       `format=xlsx` produces a two-sheet workbook — **Summary** (totals,
 *       criteria and the allocation compliance table, with deviations beyond
 *       5 points highlighted) and **Applicants** (18 columns, filterable and
 *       frozen header) — suitable for analysis.
 *
 *
 *       `format=pdf` produces a landscape document suitable for filing.
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [pdf, xlsx], default: pdf }
 *       - { in: query, name: institutionId, schema: { type: string, format: uuid } }
 *       - { in: query, name: quotaId,       schema: { type: string, format: uuid } }
 *       - { in: query, name: status,        schema: { type: string } }
 *       - { in: query, name: from,          schema: { type: string, format: date } }
 *       - { in: query, name: to,            schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: Binary report (Content-Disposition attachment)
 *         content:
 *           application/pdf: { schema: { type: string, format: binary } }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       404: { description: No applications match the filters (NO_RECORDS) }
 */
