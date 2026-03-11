import { generatePlanWithAI } from './_lib/ai.js';
import { notion, DATABASE_IDS } from './_lib/notion.js';
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
        const text = body.prompt || body.text;
        const modelId = body.modelId || 'google:gemini-2.5-flash';

        if (!text) {
            return Response.json({ error: 'No prompt provided' }, { status: 400, headers: corsHeaders });
        }

        const plan = await generatePlanWithAI(text, 'smart', modelId);

        const results = [];
        for (const item of plan.projects) {
            const matchedZoneId = ZONE_MAP[item.project.zone_id as keyof typeof ZONE_MAP] || ZONE_MAP["Other"];
            
            const projectResponse = await notion.pages.create({
                parent: { database_id: DATABASE_IDS.PROJECTS },
                icon: { emoji: ICONS.PROJECT as any },
                properties: {
                    'Name': { title: [{ text: { content: item.project.name } }] },
                    'Type': { select: { name: item.project.type === 'QUEST' ? 'QUEST' : 'Special Missions' } },
                    'Status': { status: { name: 'Not started' } },
                    'Importance': { select: { name: item.project.importance === 'important' ? 'Important' : 'Not Important' } },
                    'Urgency': { select: { name: item.project.urgency === 'urgent' ? 'Urgent' : 'Not Urgent' } },
                    'Aura Value': { number: item.project.aura_value },
                    'start date': { date: { start: item.project.start_date } },
                    'Due Date': { date: { start: item.project.final_due_date } },
                    'Zones': { relation: [{ id: matchedZoneId }] },
                    'Profile': { relation: [{ id: PROFILE_ID }] }
                }
            });

            const taskResults = [];
            for (const t of item.tasks) {
                const taskStatus = t.status === 'Completed' ? 'Completed' : 'Not started';
                const tr = await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.TASKS },
                    icon: { emoji: ICONS.TASK as any },
                    properties: {
                        'Name': { title: [{ text: { content: t.name } }] },
                        'Status': { status: { name: taskStatus } },
                        'Due Date': { date: { start: t.do_date } },
                        'Project': { relation: [{ id: projectResponse.id }] },
                        'Profile': { relation: [{ id: PROFILE_ID }] }
                    }
                });
                taskResults.push({ id: tr.id, name: t.name });
            }

            if (item.project.smart_note) {
                await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.NOTES },
                    icon: { emoji: ICONS.NOTE as any },
                    properties: {
                        'Name': { title: [{ text: { content: item.project.smart_note.title } }] },
                        'Type': { select: { name: 'Capture' } },
                        'Status': { status: { name: 'Inbox' } },
                        'Zones': { relation: [{ id: matchedZoneId }] },
                        'Project Notes': { relation: [{ id: projectResponse.id }] },
                        'Profile': { relation: [{ id: PROFILE_ID }] }
                    },
                    children: [{
                        object: 'block',
                        type: 'paragraph',
                        paragraph: { rich_text: [{ type: 'text', text: { content: item.project.smart_note.content } }] }
                    }]
                });
            }

            results.push({
                project: { id: projectResponse.id, name: item.project.name },
                tasks: taskResults
            });
        }

        return Response.json({ success: true, plan: results[0], all: results }, { headers: corsHeaders });
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
