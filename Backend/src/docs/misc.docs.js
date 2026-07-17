'use strict';

/**
 * @swagger
 * /jamb/stats:
 *   get:
 *     tags: [JAMB]
 *     summary: Regulatory dashboard statistics
 *     responses: { 200: { description: Stats } }
 *
 * /jamb/applicants:
 *   get:
 *     tags: [JAMB]
 *     summary: Audit applicants across institutions with rich filters
 *     parameters:
 *       - { in: query, name: institutionId, schema: { type: string, format: uuid } }
 *       - { in: query, name: state, schema: { type: string } }
 *       - { in: query, name: minJamb, schema: { type: number } }
 *       - { in: query, name: minPostUtme, schema: { type: number } }
 *       - { in: query, name: minAge, schema: { type: integer } }
 *       - { in: query, name: maxAge, schema: { type: integer } }
 *       - { in: query, name: status, schema: { type: string } }
 *     responses: { 200: { description: Applicants } }
 *
 * /jamb/forwarded:
 *   get:
 *     tags: [JAMB]
 *     summary: Applications forwarded to JAMB awaiting decision
 *     responses: { 200: { description: Forwarded applications } }
 *
 * /jamb/admitted:
 *   get:
 *     tags: [JAMB]
 *     summary: Admitted applicants
 *     responses: { 200: { description: Admitted } }
 *
 * /jamb/applicants/{id}:
 *   get:
 *     tags: [JAMB]
 *     summary: Applicant detail with full status history
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Applicant } }
 *
 * /jamb/applicants/{id}/decide:
 *   post:
 *     tags: [JAMB]
 *     summary: Final JAMB admission decision on a forwarded application
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [admit]
 *             properties:
 *               admit: { type: boolean }
 *               note: { type: string }
 *     responses: { 200: { description: Decided } }
 *
 * /jamb/institutions/{institutionId}/contact:
 *   post:
 *     tags: [JAMB]
 *     summary: Email an institution
 *     parameters: [{ in: path, name: institutionId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, message]
 *             properties: { subject: { type: string }, message: { type: string } }
 *     responses: { 200: { description: Sent } }
 *
 * /reports/generate:
 *   post:
 *     tags: [Reports]
 *     summary: Generate an audit-ready report (PDF)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               institutionId: { type: string, format: uuid }
 *               departmentId: { type: string, format: uuid }
 *               type: { type: string, enum: [audit_ready, admitted_list, applicants_list] }
 *     responses:
 *       201: { description: Report metadata (PDF stored) }
 *
 * /reports:
 *   get:
 *     tags: [Reports]
 *     summary: List generated reports
 *     responses: { 200: { description: Reports } }
 *
 * /reports/{id}:
 *   get:
 *     tags: [Reports]
 *     summary: Get a report by id
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Report } }
 *
 * /admission-letters/{applicationId}:
 *   get:
 *     tags: [Admission Letters]
 *     summary: Generate/return an admission letter for an admitted application
 *     description: Returns a URL when storage is configured, otherwise streams the PDF.
 *     parameters: [{ in: path, name: applicationId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Admission letter URL or PDF }
 *       400: { description: Applicant not yet admitted }
 *
 * /chatbot/message:
 *   post:
 *     tags: [Chatbot]
 *     summary: Send a message to the AI assistant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               conversationId: { type: string, format: uuid }
 *               message: { type: string }
 *     responses: { 200: { description: Assistant reply } }
 *
 * /chatbot/conversations:
 *   get:
 *     tags: [Chatbot]
 *     summary: List my conversations
 *     responses: { 200: { description: Conversations } }
 *
 * /chatbot/conversations/{id}:
 *   get:
 *     tags: [Chatbot]
 *     summary: Get a conversation with its messages
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Conversation } }
 *
 * /chatbot/escalate:
 *   post:
 *     tags: [Chatbot]
 *     summary: Escalate a conversation to a human agent (emails support)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conversationId]
 *             properties:
 *               conversationId: { type: string, format: uuid }
 *               reason: { type: string }
 *     responses: { 200: { description: Escalated } }
 *
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List my notifications
 *     responses: { 200: { description: Notifications } }
 *
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Count unread notifications
 *     responses: { 200: { description: Unread count } }
 *
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a notification read
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Marked read } }
 *
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications read
 *     responses: { 200: { description: All marked read } }
 */
