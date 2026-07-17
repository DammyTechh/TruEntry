'use strict';

/**
 * @swagger
 * /profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get the applicant profile
 *     responses:
 *       200: { description: Profile, content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' } } } }
 *   put:
 *     tags: [Profile]
 *     summary: Update biodata and preferences
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entryMode: { type: string, enum: [utme, direct_entry] }
 *               dateOfBirth: { type: string, example: "2004-05-12" }
 *               gender: { type: string, enum: [male, female] }
 *               stateOfOrigin: { type: string }
 *               lga: { type: string }
 *               address: { type: string }
 *               location: { type: string }
 *     responses:
 *       200: { description: Updated }
 *
 * /profile/completion:
 *   get:
 *     tags: [Profile]
 *     summary: Onboarding completion status
 *     description: Returns a percentage and per-check breakdown used to gate application submission.
 *     responses:
 *       200: { description: Completion status }
 *
 * /profile/verify-nin:
 *   post:
 *     tags: [Profile]
 *     summary: Verify NIN (Dojah, or mock in non-production)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nin]
 *             properties: { nin: { type: string, example: "12345678901" } }
 *     responses:
 *       200: { description: NIN verified }
 *       409: { description: NIN already linked to another account }
 *
 * /profile/verify-jamb:
 *   post:
 *     tags: [Profile]
 *     summary: Verify JAMB registration and pull the UTME score
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jambRegNo]
 *             properties: { jambRegNo: { type: string, example: "202512345678AB" } }
 *     responses:
 *       200: { description: JAMB verified }
 *       404: { description: JAMB record not found }
 *
 * /profile/verify-olevel:
 *   post:
 *     tags: [Profile]
 *     summary: Verify O-Level (WAEC/NECO/NABTEB) results
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [examType, regNo]
 *             properties:
 *               examType: { type: string, enum: [waec, neco, nabteb] }
 *               regNo: { type: string }
 *     responses:
 *       200: { description: O-Level verified with computed credit count }
 *
 * /profile/image:
 *   post:
 *     tags: [Profile]
 *     summary: Upload a passport photograph
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties: { image: { type: string, format: binary } }
 *     responses:
 *       200: { description: Image uploaded }
 */
