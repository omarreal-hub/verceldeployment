import { generatePlanWithAI } from './_lib/ai.js';
import { notion, DATABASE_IDS } from './_lib/notion.js';
import { normalizeImportance, normalizeUrgency, validateOrProvideDefaultDate } from './_lib/utils.js';
import { ZONE_MAP, PROFILE_ID, ICONS } from './_lib/constants.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, modelId, primaryModelId } = body;

        if (!prompt) {
            return Response.json({ success: false, error: 'No prompt' }, { status: 400, headers: corsHeaders });
        }

        console.log(`[API] Received multi-task request with model: ${modelId}`);

        // 1. Generate the master plan via AI
        const { projects } = await generatePlanWithAI(prompt, modelId || 'smart', primaryModelId);

        const results = [];

        for (const item of projects) {
            const { project, tasks } = item;
            
            // 2. Map Zone ID
            const matchedZoneId = ZONE_MAP[project.zone_id as keyof typeof ZONE_MAP] || ZONE_MAP["Other"];

            // 3. Create the Parent Project
            console.log(`[API] Injecting Project: ${project.name}`);
            const projectResponse = await notion.pages.create({
                parent: { database_id: DATABASE_IDS.PROJECTS },
                icon: { emoji: ICONS.PROJECT as any },
                properties: {
                    'Name': { title: [{ text: { content: project.name } }] },
                    'Importance': { select: { name: normalizeImportance(project.importance) } },
                    'Urgency': { select: { name: normalizeUrgency(project.urgency) } },
                    'Type': { select: { name: project.type } }, 
                    'Aura Value': { number: project.aura_value },
                    'start date': { date: { start: validateOrProvideDefaultDate(project.start_date) } },
                    'Due Date': { date: { start: validateOrProvideDefaultDate(project.final_due_date) } },
                    'Zones': { relation: [{ id: matchedZoneId }] },
                    'Profile': { relation: [{ id: PROFILE_ID }] }
                }
            });

            const projectId = projectResponse.id;

            // 4. Create Smart Note if exists
            if (project.smart_note) {
                console.log(`[API] Creating Smart Note for project: ${project.smart_note.title}`);
                await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.PROJECT_NOTES }, 
                    icon: { emoji: ICONS.SMART_NOTE as any },
                    properties: {
                        'Note': { title: [{ text: { content: project.smart_note.title } }] },
                        'Date': { date: { start: validateOrProvideDefaultDate(project.smart_note.created_at) } },
                        'Projects': { relation: [{ id: projectId }] }
                    },
                    children: [
                        {
                            object: 'block',
                            type: 'paragraph',
                            paragraph: {
                                rich_text: [{ type: 'text', text: { content: project.smart_note.content } }]
                            }
                        }
                    ]
                });
            }

            // 5. Create the Child Tasks linked to the Project
            const taskIds = [];
            for (const task of tasks) {
                console.log(`[API] Injecting Task: ${task.name}`);
                const taskRes = await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.TASKS },
                    icon: { emoji: ICONS.TASK as any },
                    properties: {
                        'Task Name': { title: [{ text: { content: task.name } }] },
                        'Importance': { select: { name: normalizeImportance(project.importance) } }, 
                        'Urgency': { select: { name: normalizeUrgency(project.urgency) } },       
                        'Status': { status: { name: (task.status as any) === 'Done' ? 'Completed' : task.status } },
                        'Due Date': { date: { start: validateOrProvideDefaultDate(task.do_date) } },
                        'Project': { relation: [{ id: projectId }] },
                        'Zone': { relation: [{ id: matchedZoneId }] },
                        'Profile': { relation: [{ id: PROFILE_ID }] }
                    }
                });
                taskIds.push(taskRes.id);
            }

            results.push({
                project_id: projectId,
                tasks_created: taskIds.length
            });
        }

        return Response.json({
            success: true,
            results,
            projects_count: projects.length
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('[API ERROR]', error);
        return Response.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500, headers: corsHeaders });
    }
}
