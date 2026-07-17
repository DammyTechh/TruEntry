'use strict';

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Service health and integration status
 *     security: []
 *     responses: { 200: { description: Healthy } }
 *
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Aggregate platform dashboard (users, institutions, applications, finance)
 *     responses: { 200: { description: Dashboard } }
 *
 * /admin/institution-status:
 *   get:
 *     tags: [Admin]
 *     summary: Per-institution progress (recommended/approved/forwarded/admitted)
 *     responses: { 200: { description: Overview } }
 *
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List users with filters
 *     parameters:
 *       - { in: query, name: role, schema: { type: string } }
 *       - { in: query, name: institutionId, schema: { type: string, format: uuid } }
 *       - { in: query, name: isActive, schema: { type: string, enum: [true, false] } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses: { 200: { description: Users } }
 *
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get a user
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: User } }
 *   put:
 *     tags: [Admin]
 *     summary: Update a user
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Updated } }
 *
 * /admin/users/staff:
 *   post:
 *     tags: [Admin]
 *     summary: Create a staff user (officer/registrar/jamb/admin) and email credentials
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, fullName, role]
 *             properties:
 *               email: { type: string, format: email }
 *               fullName: { type: string }
 *               role: { type: string, enum: [officer, registrar, jamb, admin] }
 *               institutionId: { type: string, format: uuid, description: "Required for officer/registrar" }
 *     responses: { 201: { description: Created } }
 *
 * /admin/users/applicant:
 *   post:
 *     tags: [Admin]
 *     summary: Manually create an applicant account
 *     responses: { 201: { description: Created } }
 *
 * /admin/users/{id}/active:
 *   patch:
 *     tags: [Admin]
 *     summary: Activate or deactivate a user
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [isActive], properties: { isActive: { type: boolean } } }
 *     responses: { 200: { description: Toggled } }
 *
 * /admin/users/{id}/reset-password:
 *   post:
 *     tags: [Admin]
 *     summary: Reset a user's password and email new credentials
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Reset } }
 *
 * /admin/finances:
 *   get:
 *     tags: [Admin]
 *     summary: Payment ledger with revenue totals
 *     parameters:
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *     responses: { 200: { description: Finances } }
 *
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Audit trail
 *     parameters:
 *       - { in: query, name: action, schema: { type: string } }
 *       - { in: query, name: entity, schema: { type: string } }
 *       - { in: query, name: userId, schema: { type: string, format: uuid } }
 *     responses: { 200: { description: Audit logs } }
 *
 * /admin/mock/{kind}:
 *   get:
 *     tags: [Admin]
 *     summary: List mock regulator records (jamb/olevel/nin)
 *     parameters: [{ in: path, name: kind, required: true, schema: { type: string, enum: [jamb, olevel, nin] } }]
 *     responses: { 200: { description: Mock records } }
 *   post:
 *     tags: [Admin]
 *     summary: Add a mock regulator record (jamb/olevel/nin)
 *     parameters: [{ in: path, name: kind, required: true, schema: { type: string, enum: [jamb, olevel, nin] } }]
 *     responses: { 201: { description: Created } }
 */
