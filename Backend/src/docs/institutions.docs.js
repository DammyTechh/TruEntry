'use strict';

/**
 * @swagger
 * /institutions:
 *   get:
 *     tags: [Institutions]
 *     summary: List institutions (public)
 *     security: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: categoryId, schema: { type: string, format: uuid } }
 *       - { in: query, name: state, schema: { type: string } }
 *       - { in: query, name: hasPostUtme, schema: { type: string, enum: [true, false] } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated institutions }
 *   post:
 *     tags: [Institutions]
 *     summary: Create an institution (admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               categoryId: { type: string, format: uuid }
 *               hasPostUtme: { type: boolean }
 *               email: { type: string, format: email }
 *               state: { type: string }
 *     responses:
 *       201: { description: Created }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /institutions/{id}:
 *   get:
 *     tags: [Institutions]
 *     summary: Get an institution with its admission parameters (public)
 *     security: []
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Institution }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Institutions]
 *     summary: Update an institution (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Institutions]
 *     summary: Delete an institution (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 204: { description: Deleted } }
 *
 * /institutions/{institutionId}/departments:
 *   get:
 *     tags: [Institutions]
 *     summary: List departments for an institution (public)
 *     security: []
 *     parameters: [{ in: path, name: institutionId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Departments } }
 *   post:
 *     tags: [Institutions]
 *     summary: Create a department (admin)
 *     parameters: [{ in: path, name: institutionId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               admissionQuota: { type: integer }
 *               jambCutoff: { type: number }
 *               postUtmeCutoff: { type: number }
 *               aggregateCutoff: { type: number }
 *     responses: { 201: { description: Created } }
 *
 * /institutions/categories:
 *   get:
 *     tags: [Institutions]
 *     summary: List institution categories (public)
 *     security: []
 *     responses: { 200: { description: Categories } }
 *   post:
 *     tags: [Institutions]
 *     summary: Create a category (admin)
 *     responses: { 201: { description: Created } }
 *
 * /institutions/me/parameters:
 *   get:
 *     tags: [Institutions]
 *     summary: Get the caller institution's admission parameters (officer/registrar)
 *     responses: { 200: { description: Parameters } }
 *   put:
 *     tags: [Institutions]
 *     summary: Update the caller institution's admission parameters (officer/registrar)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               admissionCriteria: { type: string, enum: [jamb_only, jamb_postutme_average] }
 *               minJambScore: { type: number }
 *               jambWeight: { type: number }
 *               postUtmeWeight: { type: number }
 *               totalQuota: { type: integer }
 *               admissionOpen: { type: boolean }
 *     responses: { 200: { description: Updated } }
 *
 * /institutions/me/assets/{kind}:
 *   post:
 *     tags: [Institutions]
 *     summary: Upload institution logo/letterhead/signature (officer/registrar)
 *     parameters: [{ in: path, name: kind, required: true, schema: { type: string, enum: [logo, letterhead, signature] } }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { file: { type: string, format: binary } } }
 *     responses: { 200: { description: Uploaded } }
 */
