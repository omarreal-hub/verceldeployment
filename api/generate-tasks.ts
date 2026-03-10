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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, modelId, primaryModelId, fallbackModelId } = RequestSchema.parse(body);

        const plan = await generatePlanWithAI(prompt, modelId, primaryModelId, fallbackModelId);

        const zonesResponse = await notion.databases.query({ database_id: DATABASE_IDS.ZONES });
        let matchedZoneId = null;

        for (const page of zonesResponse.results) {
            // @ts-ignore
            const titleProp = page.properties['Name']?.title?.[0]?.plain_text;
            if (titleProp && titleProp.toLowerCase().includes(plan.project.zone_name.toLowerCase())) {
                matchedZoneId = page.id;
                break;
            }
        }

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
                ...(matchedZoneId ? { 'Zones': { relation: [{ id: matchedZoneId }] } } : {})
            }
        });

        const projectId = projectResponse.id;

        const taskResults = [];
        for (const task of plan.tasks) {
            const taskRes = await notion.pages.create({
                parent: { database_id: DATABASE_IDS.TASKS },
                properties: {
                    'Task Name': { title: [{ text: { content: task.name } }] },
                    'Importance': { select: { name: normalizeImportance(task.importance) } },
                    'Urgency': { select: { name: normalizeUrgency(task.urgency) } },
                    'Status': { status: { name: task.status } },
                    'Due Date': { date: { start: validateOrProvideDefaultDate(task.do_date) } },
                    'Project': { relation: [{ id: projectId }] }
                }
            });
            taskResults.push(taskRes.id);
        }

        return Response.json({
            success: true,
            project_id: projectId,
            tasks_created: taskResults.length,
            ai_plan: plan
        });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return Response.json({ success: false, error: 'Invalid Payload', details: error.errors }, { status: 400 });
        }

        return Response.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}


