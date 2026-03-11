import { generateObject, type LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';

// --- SCHEMAS ---

export const SmartNoteSchema = z.object({
    title: z.string().describe("Short descriptive title of the note"),
    content: z.string().describe("The actual text content or URL"),
    created_at: z.string().describe("ISO 8601 YYYY-MM-DD")
}).nullable();

export const ProjectSchema = z.object({
    name: z.string(),
    importance: z.enum(['Important', 'Not Important']),
    urgency: z.enum(['Urgent', 'Not Urgent']),
    type: z.string().optional(),
    aura_value: z.number().optional().describe("A difficulty/reward score from 1-100"),
    start_date: z.string().optional().describe("ISO 8601 YYYY-MM-DD"),
    final_due_date: z.string().optional().describe("ISO 8601 YYYY-MM-DD"),
    zone_name: z.string(),
    smart_note: SmartNoteSchema
});

export const TaskSchema = z.object({
    name: z.string(),
    importance: z.enum(['Important', 'Not Important']).optional(),
    urgency: z.enum(['Urgent', 'Not Urgent']).optional(),
    do_date: z.string().optional().describe("ISO 8601 YYYY-MM-DD"),
    status: z.string().optional()
});

export const TaskGenerationSchema = z.array(z.object({
    project: ProjectSchema,
    tasks: z.array(TaskSchema)
}));

export const NoteExtractionSchema = z.object({
    title: z.string(),
    type: z.enum(['Capture', 'Resource']),
    zone: z.string().describe("Categorize into: Health, Education, Finances, Business, Personal, or Other"),
    url: z.string().optional(),
    summary: z.string().describe("A concise summary of the note content")
});

export type GeneratedTaskPlan = z.infer<typeof TaskGenerationSchema>;
export type ExtractedNote = z.infer<typeof NoteExtractionSchema>;

// --- SYSTEM MESSAGES ---

const PROJECT_ARCHITECT_SYSTEM = `You are an expert Productivity Architect.
Your goal is to parse user input into a STRUCTURED JSON LIST of projects and their associated tasks.

### INSTRUCTIONS:
1. Analyze the input. If it contains multiple distinct goals, split them into separate projects.
2. For each project, determine the "Zone" (Health, Education, Finances, Business, Personal, Other).
3. Assign an "Aura Value" (1-100) based on difficulty.

4. **TASK GENERATION LOGIC (DYNAMIC SCALING & OVERRIDE):**
   - **EXPLICIT OVERRIDE:** If the user explicitly dictates the project structure or the exact number/names of tasks, you MUST follow their instructions BLINDLY.
   - **Single/Simple Actions:** Create EXACTLY ONE task if the input is simple.
   - **Complex Goals:** Break down into 2-10 sub-tasks only for large goals.

5. **SMART NOTE EXTRACTION:**
   - Identify context/URLs and create a smart_note object.
   - **Date:** Set created_at to CURRENT DATE.

6. **CLASSIFICATION & SCHEDULING:**
   - Importance: ONLY 'Important' or 'Not Important'.
   - Urgency: ONLY 'Urgent' or 'Not Urgent'.
   - Project Type: 'QUEST' or 'Special Missions'.

### CRITICAL OUTPUT RULES:
1. Output MUST be a raw JSON List [...] of objects.
2. All dates must follow YYYY-MM-DD format.`;

const NOTE_EXTRACTOR_SYSTEM = `Analyze the following text from the user.
Extract metadata strictly following these rules:
- title: Concise and clear.
- type: 'Capture' or 'Resource' (Resource if it contains a URL).
- zone: Categorize (Health, Education, Finances, Business, Personal, Other).
- url: Extract the URL if present, otherwise null.
- summary: A clear summary of the content.

Current Date: ${new Date().toISOString().split('T')[0]}

IMPORTANT: Use ONLY 'Important'/'Not Important' for importance and 'Urgent'/'Not Urgent' for urgency.`;

// --- FUNCTIONS ---

export async function generatePlanWithAI(
    prompt: string,
    modelId: string = 'smart',
    primaryModelId: string = 'google:gemini-2.0-flash',
    fallbackModelId: string = 'groq:llama3-8b-8192'
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
    fallbackModelId: string = 'groq:llama3-8b-8192'
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
