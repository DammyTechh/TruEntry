'use strict';

/**
 * @swagger
 * /workspace/faculties:
 *   get:
 *     tags: [Institution Workspace]
 *     summary: List faculties with their department counts
 *     responses: { 200: { description: Faculties } }
 *   post:
 *     tags: [Institution Workspace]
 *     summary: Create a faculty
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string, example: Medical Sciences } }
 *     responses:
 *       201: { description: Faculty created }
 *       409: { description: A faculty with that name already exists }
 *
 * /workspace/faculties/{id}:
 *   put:
 *     tags: [Institution Workspace]
 *     summary: Rename or deactivate a faculty
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Institution Workspace]
 *     summary: Delete a faculty
 *     description: Refused while the faculty still has departments.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Deleted }
 *       400: { description: Faculty still has departments }
 *
 * /workspace/departments:
 *   get:
 *     tags: [Institution Workspace]
 *     summary: List departments (optionally filtered by faculty)
 *     parameters: [{ in: query, name: facultyId, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Departments with faculty names } }
 *   post:
 *     tags: [Institution Workspace]
 *     summary: Create a department
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:            { type: string, example: Civil Engineering }
 *               code:            { type: string, example: CVE }
 *               facultyId:       { type: string, format: uuid }
 *               admissionQuota:  { type: integer }
 *               jambCutoff:      { type: number }
 *               postUtmeCutoff:  { type: number }
 *               aggregateCutoff: { type: number }
 *     responses:
 *       201: { description: Department created }
 *       409: { description: Duplicate department name }
 *
 * /workspace/departments/{id}:
 *   put:
 *     tags: [Institution Workspace]
 *     summary: Update a department
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Institution Workspace]
 *     summary: Delete a department
 *     description: Refused when applications already reference it — deactivate instead.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Deleted }
 *       400: { description: Department has applications }
 */
