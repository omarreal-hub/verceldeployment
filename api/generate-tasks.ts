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

// Standard Profile ID from n8n logic
const PROFILE_ID = "21ff2317-55ae-8094-82ca-f82390f77977";

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

        // Fetch Zones for relation mapping
        const zonesResponse = await notion.databases.query({ database_id: DATABASE_IDS.ZONES });
        const zones = zonesResponse.results.map((p: any) => ({
            id: p.id,
            name: p.properties['Name']?.title?.[0]?.plain_text?.toLowerCase()
        }));

        for (const plan of projectPlans) {
            // 1. Find Matched Zone
            const matchedZone = zones.find(z => z.name && z.name.includes(plan.project.zone_id.toLowerCase()));

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
                    ...(matchedZone ? { 'Zones': { relation: [{ id: matchedZone.id }] } } : {})
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
                        'Profile': { relation: [{ id: PROFILE_ID }] }
                    }
                });
                summary.tasks_created++;
            }

            // 4. Create Smart Note if exists
            if (plan.project.smart_note) {
                await notion.pages.create({
                    parent: { database_id: '207f2317-55ae-8169-b1ba-fbdce796789a' },
                    properties: {
                        'Name': { title: [{ text: { content: plan.project.smart_note.title } }] },
                        'Status': { status: { name: 'Inbox' } },
                        'Profile': { relation: [{ id: PROFILE_ID }] },
                        ...(matchedZone ? { 'Zones': { relation: [{ id: matchedZone.id }] } } : {})
                    },
                    children: [
                        {
                            object: 'block',
                            type: 'paragraph',
                            paragraph: {
                                rich_text: [{ text: { content: plan.project.smart_note.content } }]
                            }
                        }
                    ]
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
