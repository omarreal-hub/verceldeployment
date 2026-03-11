import { generateObject, type LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';

// --- SCHEMAS ---

export const TaskGenerationSchema = z.object({
    projects: z.array(z.object({
        project: z.object({
            name: z.string(),
            importance: z.enum(['important', 'not important']).describe("Map to 'important' or 'not important'."),
            urgency: z.enum(['urgent', 'not urgent']).describe("Map to 'urgent' or 'not urgent'."),
            type: z.enum(['Special Missions', 'QUEST']).describe("QUEST or Special Missions."),
            aura_value: z.number().min(1).max(100),
            zone_id: z.enum(['Health', 'Education', 'Finances', 'Business', 'Personal', 'Other']),
            start_date: z.string().describe("YYYY-MM-DD"),
            final_due_date: z.string().describe("YYYY-MM-DD"),
            smart_note: z.object({
                title: z.string(),
                content: z.string(),
                created_at: z.string()
            }).nullable()
        }),
        tasks: z.array(z.object({
            name: z.string(),
            do_date: z.string().describe("YYYY-MM-DD"),
            status: z.enum(['Not started', 'In progress', 'Completed']).describe("The status of the task. Default to 'Not started'.")
        }))
    }))
});

export const NoteExtractionSchema = z.object({
    title: z.string().describe("Short descriptive title."),
    type: z.enum(['capture', 'resource']).describe("'resource' if contains URL, else 'capture'."),
    zone: z.enum(['Health', 'Education', 'Finances', 'Business', 'Personal', 'Other']),
    url: z.string().nullable().describe("Extract URL if present."),
    summary: z.string().describe("Concise summary or cleaned text.")
});

export type GeneratedTaskPlan = z.infer<typeof TaskGenerationSchema>;
export type ExtractedNote = z.infer<typeof NoteExtractionSchema>;

// --- AI LOGIC ---

export async function generatePlanWithAI(
    prompt: string,
    modelId: string = 'smart',
    primaryModelId: string = 'google:gemini-2.5-flash' // Confirmed available
): Promise<GeneratedTaskPlan> {
    const today = new Date().toISOString().split('T')[0];
    const systemMessage = `
    You are an expert Productivity Architect.
    Your goal is to parse user input into a STRUCTURED JSON LIST of projects and their associated tasks.
    CURRENT DATE: ${today}

    ### INSTRUCTIONS:
    1. Analyze input. Split into multiple projects if needed.
    2. Assign Zone, Aura (1-100), Importance/Urgency.
    3. Type MUST be "QUEST" or "Special Missions".
    4. Task Logic: Follow explicit user structure if provided, else break down complex goals (2-10 tasks).
    5. Smart Note: Extract reference material/URLs into smart_note object. Set to null if no extra context.
    6. Scheduling: "Today/Now" means ${today}. Otherwise start from tomorrow if unspecified.
  `;

    const model = getModelById(modelId === 'smart' ? primaryModelId : modelId);
    
    try {
        const { object } = await generateObject({ 
            model, 
            schema: TaskGenerationSchema, 
            system: systemMessage, 
            prompt, 
            schemaName: 'TaskGeneration',
            schemaDescription: 'Structure for multiple projects and tasks'
        });
        return object;
    } catch (error) {
        console.error(`AI Generation failed with ${modelId}.`, error);
        if (modelId !== primaryModelId) {
            const { object } = await generateObject({ 
                model: getModelById(primaryModelId),
                schema: TaskGenerationSchema, 
                system: systemMessage, 
                prompt,
                schemaName: 'TaskGeneration',
                schemaDescription: 'Structure for multiple projects and tasks'
            });
            return object;
        }
        throw error;
    }
}

export async function extractNoteWithAI(
    prompt: string,
    modelId: string = 'google:gemini-2.5-flash'
): Promise<ExtractedNote> {
    const systemMessage = `
        Analyze user text. Extract:
        - title: Short descriptive title.
        - type: 'resource' if URL present, else 'capture'.
        - zone: Health, Education, Finances, Business, Personal, Other.
        - url: Extract URL or null.
        - summary: Concise summary.
    `;

    const { object } = await generateObject({
        model: getModelById(modelId),
        schema: NoteExtractionSchema,
        system: systemMessage,
        prompt,
        schemaName: 'NoteExtraction',
        schemaDescription: 'Extract structured note from text'
    });
    return object;
}

function getModelById(id: string): LanguageModel {
    if (id.startsWith('groq:')) {
        return groq(id.replace('groq:', ''));
    }
    if (id.startsWith('google:')) {
        return google(id.replace('google:', ''));
    }
    return google('gemini-2.5-flash');
}
