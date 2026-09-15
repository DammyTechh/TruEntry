'use strict';

/**
 * @swagger
 * /quotas:
 *   get:
 *     tags: [Quotas]
 *     summary: List admission cycles for the institution
 *     parameters:
 *       - { in: query, name: page,   schema: { type: integer } }
 *       - { in: query, name: limit,  schema: { type: integer } }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, open, closed, processing, finished] }
 *     responses:
 *       200: { description: Admission cycles with department counts, allocated seats and application totals }
 *   post:
 *     tags: [Quotas]
 *     summary: Create an admission cycle
 *     description: >
 *       Defines every parameter used to process a year's admissions: the
 *       application window, JAMB cut-off, ranking rule, the regulatory
 *       allocation (National Merit / Catchment / ELDS — must total 100%),
 *       minimum O'Level requirements, accepted JAMB choice positions, and the
 *       per-department seat allocation. With `distributionMode: auto` the
 *       seats are shared evenly across the selected departments and the
 *       remainder distributed so the totals add up exactly.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:             { type: string, example: Admissions 2026 }
 *               sessionLabel:     { type: string, example: 2025/2026 }
 *               totalApplicants:  { type: integer, example: 400, description: Total seats to allocate }
 *               jambCutoff:       { type: number, example: 200 }
 *               applicationStart: { type: string, format: date }
 *               applicationEnd:   { type: string, format: date }
 *               admissionRule:
 *                 type: string
 *                 enum: [jamb_only, jamb_postutme_average]
 *                 description: Ranking basis, in descending order
 *               allocation:
 *                 type: object
 *                 description: Must total exactly 100
 *                 properties:
 *                   nationalMerit: { type: number, example: 45 }
 *                   catchment:     { type: number, example: 35 }
 *                   elds:          { type: number, example: 20 }
 *               distributionMode: { type: string, enum: [auto, manual] }
 *               choicePositions:
 *                 type: array
 *                 description: JAMB choice positions permitted to apply
 *                 items: { type: integer, minimum: 1, maximum: 4 }
 *               olevelRequirements:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     subjectGroup: { type: string, enum: [core, trade, field] }
 *                     minimumGrade: { type: string, enum: [A1,B2,B3,C4,C5,C6,D7,E8,F9] }
 *                     minCredits:   { type: integer, example: 5 }
 *                     maxSittings:  { type: integer, enum: [1, 2] }
 *               departments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     departmentId: { type: string, format: uuid }
 *                     allocated:    { type: integer, description: Required when distributionMode is manual }
 *                     isSelected:   { type: boolean }
 *     responses:
 *       201: { description: Admission cycle created }
 *       400: { description: Allocation does not total 100% }
 *       409: { description: A cycle with this name already exists }
 *
 * /quotas/open:
 *   get:
 *     tags: [Quotas]
 *     summary: The currently open admission cycle (within its date window)
 *     responses:
 *       200: { description: Open cycle, or null }
 *
 * /quotas/{id}:
 *   get:
 *     tags: [Quotas]
 *     summary: Full admission cycle including requirements and department allocation
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Admission cycle }
 *       404: { description: Not found }
 *   put:
 *     tags: [Quotas]
 *     summary: Update an admission cycle
 *     description: Requirements, choice positions and department allocation are replaced wholesale when supplied. A finished cycle cannot be edited.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Cycle is finished, or allocation invalid }
 *   delete:
 *     tags: [Quotas]
 *     summary: Delete a draft cycle
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Deleted }
 *       400: { description: Only a draft cycle can be deleted }
 *
 * /quotas/{id}/status:
 *   patch:
 *     tags: [Quotas]
 *     summary: Move a cycle through its lifecycle
 *     description: >
 *       Permitted transitions: draft→open, open→closed, closed→processing|open,
 *       processing→finished|closed. Only one cycle may be open per institution.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [draft, open, closed, processing, finished] }
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Invalid transition }
 *       409: { description: Another cycle is already open }
 *
 * /quotas/eligibility/check:
 *   post:
 *     tags: [Quotas]
 *     summary: Check an applicant against the open cycle's requirements
 *     description: >
 *       Returns a precise list of failure reasons so an applicant can be told
 *       immediately why they do not qualify. Multiple O'Level sittings are
 *       merged keeping the best grade per subject. Also classifies the
 *       applicant as national_merit, catchment or elds.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institutionId, applicant]
 *             properties:
 *               institutionId: { type: string, format: uuid }
 *               departmentId:  { type: string, format: uuid }
 *               applicant:
 *                 type: object
 *                 properties:
 *                   jambScore:      { type: number, example: 280 }
 *                   stateOfOrigin:  { type: string, example: Osun }
 *                   choicePosition: { type: integer, minimum: 1, maximum: 4 }
 *                   olevelSittings:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         examType: { type: string, example: waec }
 *                         results:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               subject: { type: string, example: Mathematics }
 *                               grade:   { type: string, example: B2 }
 *     responses:
 *       200:
 *         description: Eligibility result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     eligible: { type: boolean }
 *                     reasons:  { type: array, items: { type: string } }
 *                     admissionCategory: { type: string, enum: [national_merit, catchment, elds] }
 */
