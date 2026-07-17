'use strict';

/**
 * @swagger
 * /applications:
 *   post:
 *     tags: [Applications]
 *     summary: Create an application (applicant)
 *     description: >
 *       Creates a PENDING_PAYMENT application snapshotting the applicant's verified
 *       JAMB score and O-Level results. Initialise payment to submit it.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institutionId, departmentId, policyAccepted]
 *             properties:
 *               institutionId: { type: string, format: uuid }
 *               departmentId: { type: string, format: uuid }
 *               policyId: { type: string, format: uuid }
 *               policyAccepted: { type: boolean, enum: [true] }
 *     responses:
 *       201: { description: Application created (pending payment) }
 *       409: { description: Duplicate application to this department }
 *
 * /applications/mine:
 *   get:
 *     tags: [Applications]
 *     summary: List my applications (applicant)
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: status, schema: { type: string } }
 *     responses: { 200: { description: Paginated applications } }
 *
 * /applications/mine/{id}:
 *   get:
 *     tags: [Applications]
 *     summary: Get my application with status history (applicant)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Application }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /applications/mine/{id}/status:
 *   get:
 *     tags: [Applications]
 *     summary: Lightweight status check (applicant)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Status } }
 *
 * /applications/mine/{id}/post-utme:
 *   post:
 *     tags: [Applications]
 *     summary: Submit Post-UTME details (applicant)
 *     description: Available only while the application is QUALIFIED_POST_UTME.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               center: { type: string }
 *               responses: { type: object }
 *     responses: { 200: { description: Submitted } }
 *
 * /applications/institution:
 *   get:
 *     tags: [Applications]
 *     summary: List institution applications (officer/registrar/admin/jamb)
 *     parameters:
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: departmentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: state, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: sort, schema: { type: string, example: "-aggregate_score" } }
 *     responses: { 200: { description: Paginated applications } }
 *
 * /applications/institution/{id}:
 *   get:
 *     tags: [Applications]
 *     summary: Get one institution application (officer/registrar/admin/jamb)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Application }, 403: { $ref: '#/components/responses/Forbidden' } }
 *
 * /applications/institution/{id}/consider-post-utme:
 *   post:
 *     tags: [Applications]
 *     summary: Mark applicant (not) qualified for Post-UTME (officer)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               qualified: { type: boolean, default: true }
 *               note: { type: string }
 *     responses: { 200: { description: Updated } }
 *
 * /applications/institution/{id}/post-utme-score:
 *   post:
 *     tags: [Applications]
 *     summary: Record the Post-UTME score and compute aggregate (officer)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [score]
 *             properties:
 *               score: { type: number }
 *               maxScore: { type: number, default: 100 }
 *     responses: { 200: { description: Scored } }
 *
 * /applications/institution/{id}/recommend:
 *   post:
 *     tags: [Applications]
 *     summary: Recommend for approval (officer)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Recommended } }
 *
 * /applications/institution/{id}/approve:
 *   post:
 *     tags: [Applications]
 *     summary: Approve a recommended application (registrar)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Approved } }
 *
 * /applications/institution/{id}/reject:
 *   post:
 *     tags: [Applications]
 *     summary: Reject an application (registrar)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Rejected } }
 *
 * /applications/institution/{id}/forward-jamb:
 *   post:
 *     tags: [Applications]
 *     summary: Forward an approved application to JAMB (registrar)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Forwarded } }
 */
