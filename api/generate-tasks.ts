import { generatePlanWithAI } from './_lib/ai.js';
import { notion, DATABASE_IDS } from './_lib/notion.js';
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

const ZONE_MAP: Record<string, string> = {
    "Health": "207f231755ae81c7a048e73601f43cfc",
    "Education": "207f231755ae81c5a484c15581617ba1",
    "Finances": "207f231755ae818e9e4eca4eb85f9607",
    "Business": "207f231755ae81a5ae25f16db12897dc",
    "Personal": "207f231755ae8151bec9f62c26516e41",
    "Other": "207f231755ae81d5b00ce7acd2671833"
};

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, modelId, primaryModelId, fallbackModelId } = RequestSchema.parse(body);

        const projectPlans = await generatePlanWithAI(prompt, modelId, primaryModelId, fallbackModelId);

        const summary = {
            projects_created: 0,
            tasks_created: 0,
            notes_created: 0
        };

        for (const plan of projectPlans) {
            // 1. Get correct Zone Page ID
            const zonePageId = ZONE_MAP[plan.project.zone_id] || ZONE_MAP["Other"];

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
                    'Zones': { relation: [{ id: zonePageId }] }
                }
            });

            const projectId = projectResponse.id;
            summary.projects_created++;

            // 3. Create Tasks
            for (const task of plan.tasks) {
                await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.TASKS },
                    properties: {
                        'Task Name': { title: [{ text: { content: task.name } }] },
                        'Status': { status: { name: task.status } },
                        'Due Date': { date: { start: validateOrProvideDefaultDate(task.do_date) } },
                        'Project': { relation: [{ id: projectId }] },
                        'Profile': { relation: [{ id: PROFILE_ID }] },
                        'Zone': { relation: [{ id: zonePageId }] }
                    }
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
        if (error instanceof z.ZodError) {
            return Response.json({ success: false, error: 'Invalid Payload', details: error.issues }, {
                status: 400,
                headers: corsHeaders
            });
        }

        return Response.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500, headers: corsHeaders });
    }
}
