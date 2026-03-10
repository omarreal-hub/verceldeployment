import { notion, DATABASE_IDS, getZones } from './_lib/notion.js';
import { generatePlanWithAI } from './_lib/ai.js';
import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const RequestSchema = z.object({
    prompt: z.string(),
    modelId: z.string().optional(),
    primaryModelId: z.string().optional(),
    fallbackModelId: z.string().optional()
});

export default async function (req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    console.log('[Generate Tasks] Request received');

    try {
        const body = req.body;
        const validated = RequestSchema.parse(body);
        const { prompt, modelId, primaryModelId, fallbackModelId } = validated;

        console.log('[Generate Tasks] Calling AI for plan generation...');
        const aiResponse = await generatePlanWithAI(prompt, modelId, primaryModelId, fallbackModelId);
        
        // Handle both single project and array of projects
        const plans = Array.isArray(aiResponse) ? aiResponse : [aiResponse];
        console.log(`[Generate Tasks] AI returned ${plans.length} projects`);

        const zones = await getZones().catch(err => {
            console.error('[Generate Tasks] Failed to fetch zones:', err);
            return [];
        });

        const results = [];

        for (const plan of plans) {
            console.log(`[Generate Tasks] Processing project: ${plan.project.name}`);
            
            // 1. Match Zone
            const matchedZone = zones.find(z => 
                z.name.toLowerCase() === plan.project.zone_name.toLowerCase()
            );
            const zoneId = matchedZone?.id || null;

            // 2. Create Project
            const projectProps: any = {
                'Name': { title: [{ text: { content: plan.project.name } }] },
                'Status': { status: { name: 'Not started' } },
                'Importance': { select: { name: plan.project.importance } },
                'Urgency': { select: { name: plan.project.urgency } },
                'Profile': { relation: [{ id: DATABASE_IDS.PROFILE || '207f2317-55ae-8153-9da3-ce5cfe4dd0c8' }] }
            };

            if (zoneId) projectProps['Zones'] = { relation: [{ id: zoneId }] };
            if (plan.project.type) projectProps['Type'] = { select: { name: plan.project.type } };

            const project = await notion.pages.create({
                parent: { database_id: DATABASE_IDS.PROJECTS },
                icon: { emoji: '🚀' },
                properties: projectProps
            });

            console.log(`[Generate Tasks] Project created: ${project.id}`);

            // 3. Create Tasks
            const taskIds = [];
            for (const task of plan.tasks) {
                const taskProps: any = {
                    'Name': { title: [{ text: { content: task.name } }] },
                    'Status': { status: { name: task.status || 'Not started' } }, // Using Status for Tasks
                    'Importance': { select: { name: task.importance } },
                    'Urgency': { select: { name: task.urgency } },
                    'Project': { relation: [{ id: project.id }] }
                };

                if (zoneId) taskProps['Zone'] = { relation: [{ id: zoneId }] }; // Singular Zone for Tasks

                const taskPage = await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.TASKS },
                    icon: { emoji: '🔹' },
                    properties: taskProps
                });
                taskIds.push(taskPage.id);
            }

            // 4. Create Smart Note if exists
            if (plan.project.smart_note) {
                console.log(`[Generate Tasks] Creating smart note for: ${plan.project.name}`);
                await notion.pages.create({
                    parent: { database_id: DATABASE_IDS.PROJECT_NOTES },
                    properties: {
                        'Note': { title: [{ text: { content: plan.project.smart_note.title } }] },
                        'Project': { relation: [{ id: project.id }] },
                        'Summary': { rich_text: [{ text: { content: plan.project.smart_note.summary } }] }
                    }
                }).catch(err => console.warn('[Generate Tasks] Failed to create smart note:', err));
            }

            results.push({ project_id: project.id, task_count: taskIds.length });
        }

        return res.status(200).json({ success: true, results, ai_plan: plans });

    } catch (error) {
        console.error('[Generate Tasks] Terminal error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'Internal server error', details: message });
    }
}
