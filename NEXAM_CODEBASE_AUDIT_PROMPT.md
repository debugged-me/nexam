# NEXAM — IDE AI Agent Prompt (Read-Only Feature Comparison)

Copy the text inside the following block into Claude Code, Codex or your IDE agent, while opened at the root of your **actual NEXAM repository**. Keep `docs/NEXAM_FEATURE_ROADMAP.md` accessible from that root.

```text
You are auditing an existing NEXAM project. Read docs/NEXAM_FEATURE_ROADMAP.md completely BEFORE making any feature recommendations.

NEXAM is an AI-assisted examination PREPARATION, PAPER PRINTING, MOBILE OMR CHECKING and ANALYTICS platform. Students take examinations physically on paper; they DO NOT take online examinations in NEXAM. The frontend is React and backend is Node.js. Determine the actual mobile stack from code. Do NOT confuse NEXAM with the separate PHP/CodeIgniter SRMS project.

OBJECTIVE:
Compare every proposed feature F01–F33 in docs/NEXAM_FEATURE_ROADMAP.md against the REAL current NEXAM implementation, and tell me what is already complete, partially implemented, needs improvement, missing, or cannot be verified. Do not duplicate working functionality.

IMPORTANT USER CONTEXT:
- The mobile application may already scan answer sheets and reflect results in the web system. This is UNCONFIRMED. Verify the actual end-to-end data flow before recommending any scanner or sync implementation.
- This task is an AUDIT ONLY. Do not implement features, install dependencies, modify schema, refactor UI, rewrite services, commit changes or alter production data.
- Do not fabricate code paths, routes, APIs, tables, fields, roles, statuses, modules, test results, or screenshots.
- Do not recommend online student examination, proctoring, online exam timers, or exam-session autosave; they are outside scope.

AUDIT STEPS:
1. Inspect repository structure and manifests and locate: React pages/components; Node routes/controllers/services; database schema and migrations; question/TOS/AI modules; exam printing/export; mobile OMR code if present; synchronization; reports; tests.
2. Map the actual workflow from learning material/TOS through question generation, print-ready exam + answer sheet, mobile scan, backend synchronization, score storage and analytics. Cite exact source locations.
3. For EACH F01–F33, give a status using the roadmap classification: IMPLEMENTED, PARTIAL, MISSING, NEEDS_IMPROVEMENT, NOT_VERIFIABLE or OUT_OF_SCOPE. Include confidence, what exists, what's absent or imperfect, source paths/function names/lines where available and the next verification step.
4. Treat React page labels, placeholders or stubs as insufficient proof. For IMPLEMENTED, trace a working path across UI, server/API and persistence/output, using tests or demonstrable behavior where accessible.
5. Mobile-specific: trace sheet recognition, exam/version/answer key/student mapping, local storage if any, upload/retry, dedup/idempotency, backend auth, result persistence, web visibility, uncertain-mark handling and correction workflow. If mobile source is not in the repo, mark mobile-only functionality NOT_VERIFIABLE and separately audit observable web endpoints.
6. Identify exam/answer-key/version mismatches, data loss, duplicate result risks, permission vulnerabilities and incorrect analytics as high priorities only when supported by evidence.
7. Identify already-working capabilities to preserve. Recommend ONLY verified gaps and measurable improvements. Rank by P0/P1/P2/P3 and technical dependencies, with minimal backward-compatible solutions.
8. Write the findings to docs/NEXAM_FEATURE_AUDIT_RESULTS.md using docs/NEXAM_FEATURE_AUDIT_TEMPLATE.md. You may create/update this report document, but do not change application code.

OUTPUT REQUIREMENTS:
- Begin with a concise summary of repositories and folders inspected and any missing access.
- Include all 33 feature IDs in a single audit matrix; don't skip features.
- Give a focused, evidence-based mobile OMR ↔ Node API ↔ React display trace, or explicitly report where verification stops.
- Distinguish confirmed implemented features from proposals, potential improvements and unresolved unknowns.
- Provide a prioritized development backlog that excludes verified complete features.
- End with exact questions/tests needed to close remaining NOT_VERIFIABLE entries.

Do NOT start coding features until I approve the audit and select implementation tasks.
```

## How to use

1. Place all three Markdown files in the NEXAM repository's `docs/` directory.
2. Open the repository root in your IDE and run the prompt above with your chosen AI coding agent.
3. If the web and mobile applications live in separate repositories, provide access to **both**. Otherwise, mobile-only findings must remain `NOT_VERIFIABLE`.
4. Ask the agent to return `docs/NEXAM_FEATURE_AUDIT_RESULTS.md` for review before authorizing implementation.
