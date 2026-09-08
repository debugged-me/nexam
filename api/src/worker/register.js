/**
 * Registers all job handlers with the worker.
 *
 * This file is imported for its side effect from server.js, so handlers
 * are wired before the worker loop starts. Each handler is added as its
 * phase is built; missing ones stay as stubs that throw "not implemented."
 */
import { register } from './handlers.js';

// Phase 1 — material text extraction
import extractHandler from './handlers/extract.js';
register('extract', extractHandler);

// Phase 2 — chunking + embedding
import embedHandler from './handlers/embed.js';
register('embed', embedHandler);

// Phase 3 — syllabus → TOS auto-generation
import syllabusTosHandler from './handlers/syllabus_tos.js';
register('syllabus_tos', syllabusTosHandler);

// Phase 4 — RAG question generation
import generateHandler from './handlers/generate.js';
register('generate', generateHandler);

// Phase 6 — semantic similarity checking
import similarityHandler from './handlers/similarity.js';
register('similarity', similarityHandler);
