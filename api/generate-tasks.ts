import { generatePlanWithAI } from './_lib/ai.js';
import { notion, DATABASE_IDS, getZones } from './_lib/notion.js';
import { normalizeImportance, normalizeUrgency, validateOrProvideDefaultDate } from './_lib/utils.js';
import { z } from 'zod';

const RequestSchema = z.object({
    prompt: z.string().min(3),
    modelId: z.string().optional().default('smart'),
    primaryModelId: z.string().optional(),
    fallbackModelId: z.string().optional()
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Standard IDs derived from notion lib
const PROFILE_ID = DATABASE_IDS.PROFILE;
const PROJECT_NOTES_DB_ID = DATABASE_IDS.PROJECT_NOTES;

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, modelId, primaryModelId, fallbackModelId } = RequestSchema.parse(body);

        // 1. Fetch dynamic zones
        const zones = await getZones();

        // 2. AI Analysis
        console.log('[Generate Tasks] Starting AI analysis...');
        let aiResult = await generatePlanWithAI(prompt, modelId, primaryModelId, fallbackModelId);
        
        // Handle both Array and Object results for maximum robustness
        const projectPlans = Array.isArray(aiResult) ? aiResult : [aiResult];
        console.log('[Generate Tasks] AI Plan generated with', projectPlans.length, 'projects.');

        const summary = {
            projects_created: 0,
            tasks_created: 0,
            notes_created: 0
        };

        for (const plan of projectPlans) {
            console.log('[Generate Tasks] Processing project:', plan.project.name);
            
            // Dynamic Zone matching
            const matchedZone = zones.find(z => 
                z.name.toLowerCase().includes(plan.project.zone_name.toLowerCase())
            ) || zones[0]; // Fallback to first zone or 'Other' logic

            // 2. Create Project
            const projectResponse = await notion.pages.create({
                parent: { database_id: DATABASE_IDS.PROJECTS },
                properties: {
                    'Name': { title: [{ text: { content: plan.project.name } }] },
                    'Importance': { select: { name: normalizeImportance(plan.project.importance) } },
                    'Urgency': { select: { name: normalizeUrgency(plan.project.urgency) } },
                    'Type': { select: { name: plan.project.type } },
                    'Aura Value': { number: plan.project.aura_value },
                    'start date': { date: { start: validateOrProvideDefaultDate(plan.project.start_date) } },
                    'Due Date': { date: { start: validateOrProvideDefaultDate(plan.project.final_due_date) } },
                    'Profile': { relation: [{ id: PROFILE_ID }] },
                    'Zones': { relation: [{ id: matchedZone.id }] }
                },
                icon: { type: 'emoji', emoji: '📂' }
            });

            const projectId = projectResponse.id;
            summary.projects_created++;

            // 3. Create Tasks
            for (const task of plan.tasks) {
                // Cascading logic
                const importance = task.importance || plan.project.importance;
                const urgency = task.urgency || plan.project.urgency;

                await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.TASKS },
                    properties: {
                        'Task Name': { title: [{ text: { content: task.name } }] },
                        'Status': { status: { name: task.status } },
                        'Due Date': { date: { start: validateOrProvideDefaultDate(task.do_date) } },
                        'Project': { relation: [{ id: projectId }] },
                        'Profile': { relation: [{ id: PROFILE_ID }] },
                        'Zone': { relation: [{ id: matchedZone.id }] },
                        'Importance': { select: { name: normalizeImportance(importance) } },
                        'Urgency': { select: { name: normalizeUrgency(urgency) } }
                    },
                    icon: { type: 'emoji', emoji: '☑' }
                });
                summary.tasks_created++;
            }

            // 4. Create Smart Note if exists
            if (plan.project.smart_note) {
                await notion.pages.create({
                    parent: { database_id: PROJECT_NOTES_DB_ID },
                    properties: {
                        'Name': { title: [{ text: { content: plan.project.smart_note.title } }] },
                        'Date': { date: { start: validateOrProvideDefaultDate(plan.project.smart_note.created_at) } },
                        'Projects': { relation: [{ id: projectId }] }
                    },
                    children: [
                        {
                            object: 'block',
                            type: 'paragraph',
                            paragraph: {
                                rich_text: [{ text: { content: plan.project.smart_note.content } }]
                            }
                        }
                    ],
                    icon: { type: 'emoji', emoji: '📝' }
                });
                summary.notes_created++;
            }
        }

        return Response.json({
            success: true,
            summary,
            ai_plan: projectPlans
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('[Generate Tasks Error]', error);
        return Response.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500, headers: corsHeaders });
    }
}
