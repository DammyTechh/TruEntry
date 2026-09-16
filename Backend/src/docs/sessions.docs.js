'use strict';

/**
 * @swagger
 * tags:
 *   - name: Application Sessions
 *     description: >
 *       The applicant journey. Onboarding captures records only; credential
 *       verification costs money, so it happens AFTER payment:
 *       start → pay → verify → JAMB choices populate → apply.
 *
 * /sessions/quote:
 *   get:
 *     tags: [Application Sessions]
 *     summary: Fee quote for one vs two O'Level sittings
 *     description: >
 *       Powers the sitting-type dropdown. Two sittings cost more because a
 *       second O'Level result must also be verified.
 *     responses:
 *       200:
 *         description: Quote
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     one:
 *                       type: object
 *                       properties:
 *                         totalNaira: { type: number, example: 20000 }
 *                     two:
 *                       type: object
 *                       properties:
 *                         examProcessingNaira: { type: number, example: 20000 }
 *                         secondSittingNaira:  { type: number, example: 10000 }
 *                         totalNaira:          { type: number, example: 30000 }
 *
 * /sessions/current:
 *   get:
 *     tags: [Application Sessions]
 *     summary: The applicant's latest session (resume point)
 *     responses: { 200: { description: Session, or null } }
 *
 * /sessions:
 *   post:
 *     tags: [Application Sessions]
 *     summary: Start an admission attempt
 *     description: >
 *       Creates a session and captures the fee breakdown at today's prices. If
 *       an unpaid or in-flight session already exists it is returned instead,
 *       so the applicant resumes rather than paying twice.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sittingType: { type: string, enum: [one, two], default: one }
 *     responses:
 *       201: { description: Session started or resumed }
 *
 * /sessions/{id}/sitting-type:
 *   patch:
 *     tags: [Application Sessions]
 *     summary: Change one/two sittings before payment
 *     description: Re-prices the session. Refused once payment has been made.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sittingType]
 *             properties:
 *               sittingType: { type: string, enum: [one, two] }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Session already paid (SESSION_LOCKED) }
 *
 * /payments/session/initialize:
 *   post:
 *     tags: [Payments]
 *     summary: Pay the exam-processing fee for a session
 *     description: >
 *       Returns a Paystack authorization URL. The amount comes from the
 *       session's captured breakdown, so a later price change never alters an
 *       in-flight purchase. Settlement (redirect or webhook) moves the session
 *       to `paid`, which unlocks verification.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId: { type: string, format: uuid }
 *     responses:
 *       200: { description: authorizationUrl + reference }
 *       400: { description: Already paid }
 *
 * /sessions/{id}/verify:
 *   post:
 *     tags: [Application Sessions]
 *     summary: Verify JAMB and O'Level credentials
 *     description: >
 *       Permitted only once the session is paid — verification is what the fee
 *       buys. The number of O'Level sittings supplied must match the number
 *       paid for. On success the JAMB response populates the candidate's
 *       institution/course choices and the verified state is mirrored onto the
 *       applicant profile.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jambRegNo, olevel]
 *             properties:
 *               jambRegNo: { type: string, example: 202412345678AB }
 *               olevel:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 2
 *                 items:
 *                   type: object
 *                   properties:
 *                     examType: { type: string, enum: [waec, neco, nabteb] }
 *                     regNo:    { type: string }
 *     responses:
 *       200: { description: Verified }
 *       400: { description: PAYMENT_REQUIRED or SITTING_COUNT_MISMATCH }
 *       404: { description: JAMB or O'Level record not found }
 *
 * /sessions/{id}/choices:
 *   get:
 *     tags: [Application Sessions]
 *     summary: JAMB choices with an eligibility verdict for each
 *     description: >
 *       Returns the institution/course choices the candidate gave JAMB, each
 *       matched to a TruEntry institution and department where possible, and
 *       evaluated against that school's open admission cycle. Ineligible
 *       choices carry the specific reasons so the applicant is told
 *       immediately why they do not qualify.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200:
 *         description: Choices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       choicePosition:   { type: integer }
 *                       institutionName:  { type: string }
 *                       courseName:       { type: string }
 *                       onPlatform:       { type: boolean }
 *                       institutionId:    { type: string, format: uuid, nullable: true }
 *                       departmentId:     { type: string, format: uuid, nullable: true }
 *                       eligible:         { type: boolean }
 *                       reasons:          { type: array, items: { type: string } }
 *                       admissionCategory: { type: string, enum: [national_merit, catchment, elds] }
 *       400: { description: NOT_VERIFIED }
 *
 * /sessions/{id}/apply:
 *   post:
 *     tags: [Application Sessions]
 *     summary: Complete the application for a chosen course
 *     description: >
 *       Re-checks eligibility server-side before creating the application, so
 *       a client that ignores the verdict still cannot submit. Refused with
 *       NOT_ELIGIBLE and the reasons when the applicant does not qualify.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institutionId, departmentId]
 *             properties:
 *               institutionId:  { type: string, format: uuid }
 *               departmentId:   { type: string, format: uuid }
 *               choicePosition: { type: integer, minimum: 1, maximum: 4 }
 *     responses:
 *       201: { description: Application submitted }
 *       400: { description: NOT_ELIGIBLE (reasons in error.details) or NOT_VERIFIED }
 *       409: { description: Already applied to this course }
 */
