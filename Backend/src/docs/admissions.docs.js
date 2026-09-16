'use strict';

/**
 * @swagger
 * /quotas/{id}/admissions/summary:
 *   get:
 *     tags: [Admissions]
 *     summary: Headline numbers for an admission cycle
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Totals, admitted, pending and allocated seats } }
 *
 * /quotas/{id}/admissions/applicants:
 *   get:
 *     tags: [Admissions]
 *     summary: Ranked applicants in a cycle
 *     description: >
 *       Ordered by score descending. Each row carries the ranking score under
 *       the cycle's stated rule (JAMB only, or the JAMB/Post-UTME average) and
 *       the regulatory category the candidate falls into.
 *     parameters:
 *       - { in: path,  name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: departmentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: status,       schema: { type: string } }
 *       - { in: query, name: search,       schema: { type: string } }
 *       - { in: query, name: page,         schema: { type: integer } }
 *       - { in: query, name: limit,        schema: { type: integer } }
 *     responses: { 200: { description: Applicants (meta.quota carries the cycle's rule and cut-off) } }
 *
 * /quotas/{id}/admissions/process:
 *   post:
 *     tags: [Admissions]
 *     summary: Preview or run the admission exercise
 *     description: >
 *       Ranks candidates in descending order by the cycle's rule and fills each
 *       department's seats, split by the regulatory allocation
 *       (National Merit / Catchment / ELDS). Candidates below the JAMB cut-off
 *       are never admitted. Where a category's seats are unused, candidates
 *       spill into remaining merit seats rather than the seats being wasted.
 *
 *
 *       `commit: false` is a dry run that writes nothing. `commit: true`
 *       records the decisions and emails admitted candidates. Re-running is
 *       safe: seats already used by earlier runs are counted, so the quota is
 *       never exceeded.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commit:       { type: boolean, default: false }
 *               departmentId: { type: string, format: uuid, description: Restrict to one department }
 *     responses:
 *       200: { description: Selected and waitlisted candidates per department }
 *       400: { description: Cycle is in a state that cannot be processed }
 *
 * /quotas/{id}/admissions/close:
 *   post:
 *     tags: [Admissions]
 *     summary: Finish the admission exercise
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Cycle finished }
 *       400: { description: Cycle has not been closed to applications yet }
 *
 * /quotas/applications/{applicationId}/decide:
 *   post:
 *     tags: [Admissions]
 *     summary: Admit or reject a single applicant
 *     parameters: [{ in: path, name: applicationId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [admit]
 *             properties:
 *               admit: { type: boolean }
 *               note:  { type: string }
 *     responses: { 200: { description: Decision recorded and the applicant emailed } }
 *
 * /quotas/applications/{applicationId}/switch-department:
 *   post:
 *     tags: [Admissions]
 *     summary: Move an applicant to another department
 *     parameters: [{ in: path, name: applicationId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [departmentId]
 *             properties:
 *               departmentId: { type: string, format: uuid }
 *               note:         { type: string }
 *     responses:
 *       200: { description: Applicant moved }
 *       400: { description: Department does not belong to this institution }
 */
