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
        const defaultZoneId = zones.length > 0 ? zones[0].id : null;

        // 2. AI Analysis
        console.log('[Generate Tasks] Starting AI analysis...');
        let aiResult = await generatePlanWithAI(prompt, modelId, primaryModelId, fallbackModelId);
        
        const projectPlans = Array.isArray(aiResult) ? aiResult : (aiResult ? [aiResult] : []);
        console.log('[Generate Tasks] AI Plan generated with', projectPlans.length, 'projects.');

        const summary = {
            projects_created: 0,
            tasks_created: 0,
            notes_created: 0
        };

        for (const plan of projectPlans) {
            if (!plan || !plan.project) continue;

            console.log('[Generate Tasks] Processing project:', plan.project.name);
            
            // Dynamic Zone matching
            const matchedZone = zones.find(z => 
                z.name.toLowerCase().includes(plan.project.zone_name.toLowerCase())
            );
            const zoneId = matchedZone?.id || defaultZoneId;

            // 2. Create Project
            const projectProps: any = {
                'Name': { title: [{ text: { content: plan.project.name } }] },
                'Importance': { select: { name: normalizeImportance(plan.project.importance) } },
                'Urgency': { select: { name: normalizeUrgency(plan.project.urgency) } }
            };

            if (plan.project.type) projectProps['Type'] = { select: { name: plan.project.type } };
            if (plan.project.aura_value) projectProps['Aura Value'] = { number: plan.project.aura_value };
            if (plan.project.start_date) projectProps['start date'] = { date: { start: validateOrProvideDefaultDate(plan.project.start_date) } };
            if (plan.project.final_due_date) projectProps['Due Date'] = { date: { start: validateOrProvideDefaultDate(plan.project.final_due_date) } };
            
            // Relations
            if (PROFILE_ID) projectProps['Profile'] = { relation: [{ id: PROFILE_ID }] };
            if (zoneId) projectProps['Zones'] = { relation: [{ id: zoneId }] };

            const projectResponse = await notion.pages.create({
                parent: { database_id: DATABASE_IDS.PROJECTS },
                properties: projectProps,
                icon: { type: 'emoji', emoji: '📂' }
            });

            const projectId = projectResponse.id;
            summary.projects_created++;

            // 3. Create Tasks
            for (const task of plan.tasks) {
                const importance = task.importance || plan.project.importance;
                const urgency = task.urgency || plan.project.urgency;

                const taskProps: any = {
                    'Task Name': { title: [{ text: { content: task.name } }] },
                    'Status': { status: { name: task.status || 'Not started' } },
                    'Importance': { select: { name: normalizeImportance(importance) } },
                    'Urgency': { select: { name: normalizeUrgency(urgency) } }
                };

                if (task.do_date) taskProps['Due Date'] = { date: { start: validateOrProvideDefaultDate(task.do_date) } };
                if (projectId) taskProps['Project'] = { relation: [{ id: projectId }] };
                if (PROFILE_ID) taskProps['Profile'] = { relation: [{ id: PROFILE_ID }] };
                if (zoneId) taskProps['Zone'] = { relation: [{ id: zoneId }] };

                await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.TASKS },
                    properties: taskProps,
                    icon: { type: 'emoji', emoji: '☑' }
                });
                summary.tasks_created++;
            }

            if (plan.project.smart_note) {
                await notion.pages.create({
                    parent: { database_id: PROJECT_NOTES_DB_ID },
                    properties: {
                        'Note': { title: [{ text: { content: plan.project.smart_note.title } }] },
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
