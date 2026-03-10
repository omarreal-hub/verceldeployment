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
    importance: z.enum(['important', 'not important']),
    urgency: z.enum(['urgent', 'not urgent']),
    type: z.enum(['QUEST', 'Special Missions']),
    aura_value: z.number().min(1).max(100),
    zone_id: z.enum(['Health', 'Education', 'Finances', 'Business', 'Personal', 'Other']),
    start_date: z.string().describe("ISO 8601 YYYY-MM-DD"),
    final_due_date: z.string().describe("ISO 8601 YYYY-MM-DD"),
    smart_note: SmartNoteSchema
});

export const TaskSchema = z.object({
    name: z.string(),
    do_date: z.string().describe("ISO 8601 YYYY-MM-DD"),
    status: z.enum(['Not started', 'In progress', 'Completed']).default('Not started')
});

export const TaskGenerationSchema = z.array(z.object({
    project: ProjectSchema,
    tasks: z.array(TaskSchema)
}));

export const NoteExtractionSchema = z.object({
    title: z.string().describe("A short, descriptive title for the note."),
    type: z.enum(["capture", "resource"]).describe("Set to 'resource' if the text contains a URL, otherwise 'capture'."),
    zone: z.enum(["Health", "Education", "Finances", "Business", "Personal", "Other"]).describe("The category or life area based on the content context."),
    url: z.string().nullable().describe("Extract the URL if present, otherwise return null."),
    summary: z.string().describe("A concise summary of the content or the cleaned text itself.")
});

export type GeneratedTaskPlan = z.infer<typeof TaskGenerationSchema>;
export type ExtractedNote = z.infer<typeof NoteExtractionSchema>;

// --- SYSTEM MESSAGES ---

const PROJECT_ARCHITECT_SYSTEM = `
You are an expert Productivity Architect.
Your goal is to parse user input into a STRUCTURED JSON LIST of projects and their associated tasks.

### INSTRUCTIONS:
1. Analyze the input. If it contains multiple distinct goals, split them into separate projects.
2. For each project, determine the "Zone" (Health, Education, Finances, Business, Personal, Other).
3. Assign an "Aura Value" (1-100) based on difficulty.

4. **TASK GENERATION LOGIC (DYNAMIC SCALING & OVERRIDE):**
   - **EXPLICIT OVERRIDE:** If the user explicitly dictates the project structure or the exact number/names of tasks, you MUST follow their instructions BLINDLY. Do not add, remove, or invent tasks.
   - **Single/Simple Actions:** If the user input is a clear, simple action and provides no specific structure, create EXACTLY ONE task that directly represents this action.
   - **Complex Goals:** ONLY if the input is a large goal without user-specified steps, break it down intelligently into actionable sub-tasks (2 to 10 max).

5. **SMART NOTE EXTRACTION:**
   - Identify any reference materials, URLs, specific context, or "brain dump" details.
   - If found, create a smart_note object inside the project.
   - If NO extra context is found, set smart_note to null.

6. **SCHEDULING LOGIC:**
   - Today is ${new Date().toISOString().split('T')[0]}. Use YYYY-MM-DD for all dates.
   - If user says "Today", "Now", or "Tonight", use CURRENT DATE.
   - If user specifies a date, use it. Otherwise, starting from tomorrow.

### CLASSIFICATION RULES:
1. Project Type MUST be either "QUEST" or "Special Missions".
2. NEVER use "Task" as a project type.
`;

const NOTE_EXTRACTOR_SYSTEM = `
Analyze the provided text from the user.
Extract the information strictly adhering to the structure:
- title: Short, descriptive.
- type: 'resource' if URL present, else 'capture'.
- zone: Health, Education, Finances, Business, Personal, or Other.
- url: The link if found, else null.
- summary: Concise summary or cleaned text.
`;

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
    modelId: string = 'google:gemini-2.0-flash'
): Promise<ExtractedNote> {
    const model = getModelById(modelId);
    const { object } = await generateObject({
        model,
        schema: NoteExtractionSchema,
        system: NOTE_EXTRACTOR_SYSTEM,
        prompt: `User Input: ${text}`
    });
    return object;
}

function getModelById(id: string): LanguageModel {
    if (id.startsWith('groq:')) return groq(id.replace('groq:', ''));
    if (id.startsWith('google:')) return google(id.replace('google:', ''));
    return google('gemini-2.0-flash');
}
