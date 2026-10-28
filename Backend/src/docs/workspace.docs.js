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
 *               minCredits:      { type: integer, minimum: 0, maximum: 9, example: 5 }
 *               maxSittings:     { type: integer, minimum: 1, maximum: 2, example: 2 }
 *               olevelNotes:     { type: string, example: Further Mathematics accepted in place of Physics }
 *               olevelRequirements:
 *                 type: array
 *                 description: >
 *                   The O'Level subjects this course requires, typed in by the
 *                   institution while the department is being created. Applicants
 *                   are checked against them before applying and again when
 *                   admissions are processed. Sending the array replaces the whole
 *                   set; sending [] clears it.
 *                 items:
 *                   type: object
 *                   required: [subject]
 *                   properties:
 *                     subject:      { type: string, example: Mathematics }
 *                     minimumGrade: { type: string, enum: [A1, B2, B3, C4, C5, C6, D7, E8, F9], default: C6 }
 *                     isCompulsory: { type: boolean, default: true }
 *     responses:
 *       201: { description: Department created with its requirements }
 *       409: { description: Duplicate department name }
 *
 * /workspace/departments/{id}:
 *   get:
 *     tags: [Institution Workspace]
 *     summary: One department with its O'Level requirements
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Department } }
 *   put:
 *     tags: [Institution Workspace]
 *     summary: Update a department (and replace its O'Level requirements)
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
