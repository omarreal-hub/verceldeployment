import { VercelRequest, VercelResponse } from '@vercel/node';
import { notion, DATABASE_IDS, getZones } from './_lib/notion';
import { generatePlanWithAI } from './_lib/ai';
import { normalizeUrgency, normalizeImportance, validateOrProvideDefaultDate } from './_lib/utils';
import { z } from 'zod';

const RequestSchema = z.object({
    text: z.string().optional(),
    prompt: z.string().optional(),
    message: z.object({
        text: z.string()
    }).optional(),
    modelId: z.string().optional(),
    primaryModelId: z.string().optional(),
    fallbackModelId: z.string().optional()
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const body = RequestSchema.parse(req.body);
        const text = body.prompt || body.text || body.message?.text;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        // 1. AI Generation (n8n Logic)
        const plan = await generatePlanWithAI(
            text,
            body.modelId,
            body.primaryModelId,
            body.fallbackModelId
        );

        const zones = await getZones();
        const results = [];

        for (const item of plan) {
            const { project, tasks } = item;

            // Mapping Zone ID
            const matchedZone = zones.find(z => z.name.toLowerCase() === project.zone_id.toLowerCase()) || 
                              zones.find(z => z.name === 'Other');

            // 2. Create Project (n8n Mapping)
            const createdProject = await notion.pages.create({
                parent: { database_id: DATABASE_IDS.PROJECTS },
                icon: { type: 'emoji', emoji: '📂' },
                properties: {
                    'Name': { title: [{ text: { content: project.name } }] },
                    'Due Date': { date: { start: validateOrProvideDefaultDate(project.final_due_date) } },
                    'Type': { select: { name: project.type } },
                    'Aura Value': { number: project.aura_value || 0 },
                    'Urgency': { select: { name: normalizeUrgency(project.urgency) } },
                    'Importance': { select: { name: normalizeImportance(project.importance) } },
                    'Zones': { relation: matchedZone ? [{ id: matchedZone.id }] : [] },
                    'Profile': { relation: [{ id: DATABASE_IDS.PROFILE }] },
                    'start date': { date: { start: validateOrProvideDefaultDate(project.start_date) } }
                }
            });

            // 3. Create Smart Note if exists (n8n Mapping)
            if (project.smart_note) {
                await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.PROJECT_NOTES },
                    icon: { type: 'emoji', emoji: '📝' },
                    properties: {
                        'Note': { title: [{ text: { content: project.smart_note.title } }] },
                        'Date': { date: { start: validateOrProvideDefaultDate(project.smart_note.created_at) } },
                        'Projects': { relation: [{ id: createdProject.id }] }
                    },
                    children: [
                        {
                            object: 'block',
                            type: 'paragraph',
                            paragraph: {
                                rich_text: [{ text: { content: project.smart_note.content } }]
                            }
                        }
                    ]
                });
            }

            // 4. Create Tasks (n8n Mapping)
            for (const task of tasks) {
                await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.TASKS },
                    icon: { type: 'emoji', emoji: '☑' },
                    properties: {
                        'Task Name': { title: [{ text: { content: task.name } }] },
                        'Due Date': { date: { start: validateOrProvideDefaultDate(task.do_date) } },
                        'Project': { relation: [{ id: createdProject.id }] },
                        'Zone': { relation: matchedZone ? [{ id: matchedZone.id }] : [] },
                        'Profile': { relation: [{ id: DATABASE_IDS.PROFILE }] },
                        'Importance': { select: { name: normalizeImportance(project.importance) } },
                        'Urgency': { select: { name: normalizeUrgency(project.urgency) } },
                        'Status': { status: { name: 'Not started' } }
                    }
                });
            }

            results.push({ projectId: createdProject.id, taskCount: tasks.length });
        }

        return res.status(200).json({ success: true, results });
    } catch (error: any) {
        console.error('Error generating projects/tasks:', error);
        return res.status(500).json({ error: error.message });
    }
}
