# TASK: Generate a College Syllabus

You are generating a complete, realistic college syllabus that will be uploaded to the Nexam exam-building system. The Nexam system will extract topics, instructional hours, and learning outcomes from your output to auto-generate a Table of Specifications (TOS), and will use the full text as source material for AI question generation.

**Do NOT review, summarize, or comment on this specification.** Your output must be the syllabus itself — a single, ready-to-upload document.

## What to produce

Generate a full college syllabus for the course the user specifies (e.g., "Biology 101", "College Algebra", "Philippine History"). If the user does not specify a course, generate one for "Introduction to Cell Biology (BIO 101)".

Your entire response must be the syllabus document. No preamble, no summary, no commentary — just the syllabus.

## Output format

Output the syllabus as Markdown. The user will save it as a `.md` or `.txt` file and upload it to Nexam.

## Requirements

1. **Length**: 5-15 pages of actual content. This is a real college syllabus, not a one-page outline.
2. **Single document**: Everything in one file. Do not split across files.
3. **Realistic content**: Use real, specific, substantive content — not generic filler. The subtopic descriptions become the source material that the AI uses to generate exam questions, so vague text produces vague questions.
4. **Instructional hours**: Every weekly unit must include instructional hours. A 16-week course typically totals 48-64 instructional hours. Hours drive TOS item weighting (more hours = more exam items).
5. **Subtopics**: Each weekly unit must have 4-6 concrete subtopic bullets with specific, detailed content. "Cell membrane" alone is too sparse; "The fluid mosaic model: phospholipids, cholesterol, and proteins" gives the AI something specific to ground questions in.
6. **Bloom verbs**: Learning outcomes must use Bloom's Taxonomy verbs (define, explain, apply, analyze, evaluate, create). Spread outcomes across all six Bloom levels.
7. **Language**: English.

## Required sections (in this order)

### 1. Institution Header
```
[University Name]
[College / Department]
[Course Title] — [Course Code]
[Term / Semester] [Year]
```

### 2. Instructor Information
Name, credentials, email, office, office hours.

### 3. Course Details
Course title, code, credit units, prerequisites, course format, meeting schedule.

### 4. Course Description
A full paragraph (5-15 sentences) describing the course, its scope, what it covers, and its place in the curriculum. Be specific — this text is retrieved by the AI during question generation.

### 5. Course Objectives / Learning Outcomes
8-15 measurable outcomes using Bloom's Taxonomy verbs. Spread across all six levels:
- **Remember**: define, list, identify, name, recall
- **Understand**: explain, describe, summarize, interpret
- **Apply**: apply, demonstrate, use, solve, calculate
- **Analyze**: analyze, compare, contrast, differentiate, examine
- **Evaluate**: evaluate, assess, justify, critique, recommend
- **Create**: design, create, develop, construct, formulate

### 6. Required Materials
Textbook(s) with full citation, lab manual, other materials.

### 7. Detailed Weekly Schedule (MOST IMPORTANT SECTION)

Provide a full week-by-week breakdown for 16 weeks. Use a **detailed list format** (NOT a compact table), because the subtopic text is what the AI retrieves to ground questions.

Each week must include:
- Week number and topic title
- Instructional hours
- 4-6 subtopic bullets with specific, substantive content
- Learning outcomes for that week (using Bloom verbs)
- Readings (chapter/page references)
- Assessment due that week (if any)

**Example of the expected detail level for one week:**

```
Week 3: The Cell Membrane — Structure and Function (4 hours)

Subtopics:
- The fluid mosaic model: phospholipids, cholesterol, and proteins
- Membrane proteins: integral, peripheral, and lipid-anchored
- Membrane fluidity and factors that affect it (temperature, fatty acid saturation, cholesterol)
- The functions of the cell membrane: barrier, transport, signaling, adhesion
- Cell-cell recognition and the glycocalyx

Learning outcomes: Students can explain the fluid mosaic model, describe the types
of membrane proteins, and list the functions of the cell membrane.

Readings: Alberts Chapter 2, pages 30-55
Assessment: Quiz 2
```

### 8. Grading Policy
Grade components with weights (must total 100%), grading scale (A-F with numeric ranges).

### 9. Course Policies
Attendance, late submissions, academic integrity, make-up exams, classroom conduct.

### 10. University Policies (brief)
Disability accommodations, Title IX, mental health resources.

## Why detail matters

The Nexam system uses Retrieval-Augmented Generation (RAG):
1. Your syllabus text is split into chunks and embedded in a vector database
2. When generating questions, the AI retrieves the most relevant chunks
3. The retrieved text is included in the prompt so questions are grounded in your actual material
4. **More detailed subtopics = better, more specific questions. A sparse outline gives the AI nothing to ground questions in.**

## Reminder

Your output is the syllabus. Not a review, not a summary, not a plan — the actual syllabus document, ready to upload. Start writing it now.
