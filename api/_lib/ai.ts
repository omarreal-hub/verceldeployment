import { generateObject, type LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';

// --- SCHEMAS (DIRECT FROM n8n) ---

export const NoteExtractionSchema = z.object({
    title: z.string().describe("A short, descriptive title for the note."),
    type: z.enum(['capture', 'resource']).describe("Set to 'resource' if the text contains a URL, otherwise 'capture'."),
    zone: z.enum(['Health', 'Education', 'Finances', 'Business', 'Personal', 'Other']).describe("The category or life area based on the content context."),
    url: z.string().nullable().describe("Extract the URL if present, otherwise return null or empty string."),
    summary: z.string().describe("A concise summary of the content or the cleaned text itself.")
});

export const ProjectSchema = z.object({
    name: z.string(),
    importance: z.string().describe("important/not important"),
    urgency: z.string().describe("urgent/not urgent"),
    type: z.string().describe("Select: QUEST | Special Missions"),
    aura_value: z.number(),
    zone_id: z.enum(['Health', 'Education', 'Finances', 'Business', 'Personal', 'Other']),
    start_date: z.string().describe("YYYY-MM-DD"),
    final_due_date: z.string().describe("YYYY-MM-DD"),
    smart_note: z.object({
        title: z.string(),
        content: z.string(),
        created_at: z.string()
    }).nullable()
});

export const TaskSchema = z.object({
    name: z.string(),
    do_date: z.string().describe("YYYY-MM-DD"),
    status: z.string()
});

export const TaskGenerationSchema = z.array(z.object({
    project: ProjectSchema,
    tasks: z.array(TaskSchema)
}));

export type GeneratedTaskPlan = z.infer<typeof TaskGenerationSchema>;
export type ExtractedNote = z.infer<typeof NoteExtractionSchema>;

// --- SYSTEM MESSAGES (EXACT FROM n8n) ---

const NOTE_EXTRACTOR_SYSTEM = `Analyze the following text from the user.
Extract the information strictly adhering to the format instructions provided.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}`;

const PROJECT_ARCHITECT_SYSTEM = `You are an expert Productivity Architect.
Your goal is to parse user input into a STRUCTURED JSON LIST of projects and their associated tasks.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}

### INSTRUCTIONS:
1. Analyze the input. If it contains multiple distinct goals, split them into separate projects.
2. For each project, determine the "Zone" (Health, Education, Finances, Business, Personal, Other).
3. Assign an "Aura Value" (1-100) based on difficulty.

4. **TASK GENERATION LOGIC (DYNAMIC SCALING & OVERRIDE):**
   - **EXPLICIT OVERRIDE:** If the user explicitly dictates the project structure or the exact number/names of tasks (e.g., "Create 1 project with 2 tasks: A and B"), you MUST follow their instructions BLINDLY. Do not add, remove, or invent tasks.
   - **Single/Simple Actions:** If the user input is a clear, simple action and provides no specific structure, create EXACTLY ONE task that directly represents this action. Do not overcomplicate.
   - **Complex Goals:** ONLY if the input is a large goal without user-specified steps, break it down intelligently into actionable sub-tasks (2 to 10 max).

5. **SMART NOTE EXTRACTION:**
   - Identify any reference materials, URLs, specific context, or "brain dump" details.
   - If found, create a \`smart_note\` object inside the project.
   - **Title:** Generate a short, descriptive title for the note.
   - **Content:** Include the raw text, URL, or mixed content.
   - **Date:** Set \`created_at\` to CURRENT DATE.
   - If NO extra context is found, set \`smart_note\` to \`null\`.

6. **SCHEDULING LOGIC:**
   - If the user says "Today", "Now", or "Tonight", you MUST schedule tasks for the CURRENT DATE.
   - If the user specifies a date, use that date.
   - ONLY if no date is specified, schedule starting from tomorrow.

### CLASSIFICATION RULES (STRICT):
1. Project Type MUST be either "QUEST" or "Special Missions".
2. NEVER use "Task" as a project type.

### CRITICAL OUTPUT RULES:
1. Output MUST be a raw JSON List \`[...]\`.
2. All dates must follow \`YYYY-MM-DD\` format.`;

// --- FUNCTIONS ---

export async function generatePlanWithAI(
    prompt: string,
    modelId: string = 'smart',
    primaryModelId: string = 'google:gemini-2.0-flash',
    fallbackModelId: string = 'groq:llama-3.1-8b-instant'
): Promise<GeneratedTaskPlan> {
    const model = getModelById(modelId === 'fallback' ? fallbackModelId : (modelId === 'smart' || modelId === 'primary' ? primaryModelId : modelId));

    try {
        const { object } = await generateObject({
            model,
            schema: TaskGenerationSchema,
            system: PROJECT_ARCHITECT_SYSTEM,
            prompt
        });
        return object;
    } catch (error) {
        if (modelId === 'smart' || modelId === 'primary') {
            console.error(`Primary model failed, falling back...`, error);
            const fallbackModel = getModelById(fallbackModelId);
            const { object } = await generateObject({
                model: fallbackModel,
                schema: TaskGenerationSchema,
                system: PROJECT_ARCHITECT_SYSTEM,
                prompt
            });
            return object;
        }
        throw error;
    }
}

export async function extractNoteWithAI(
    text: string,
    modelId: string = 'smart',
    primaryModelId: string = 'google:gemini-2.0-flash',
    fallbackModelId: string = 'groq:llama-3.1-8b-instant'
): Promise<ExtractedNote> {
    const model = getModelById(modelId === 'fallback' ? fallbackModelId : (modelId === 'smart' || modelId === 'primary' ? primaryModelId : modelId));

    try {
        const { object } = await generateObject({
            model,
            schema: NoteExtractionSchema,
            system: NOTE_EXTRACTOR_SYSTEM,
            prompt: `User Input: ${text}`
        });
        return object;
    } catch (error) {
        if (modelId === 'smart' || modelId === 'primary') {
            console.error(`Primary model failed for note, falling back...`, error);
            const fallbackModel = getModelById(fallbackModelId);
            const { object } = await generateObject({
                model: fallbackModel,
                schema: NoteExtractionSchema,
                system: NOTE_EXTRACTOR_SYSTEM,
                prompt: `User Input: ${text}`
            });
            return object;
        }
        throw error;
    }
}

function getModelById(id: string): LanguageModel {
    if (id.startsWith('groq:')) return groq(id.replace('groq:', ''));
    if (id.startsWith('google:')) return google(id.replace('google:', ''));
    return google('gemini-2.0-flash');
}
