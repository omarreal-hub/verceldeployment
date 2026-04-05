import { notion, DATABASE_IDS } from './_lib/notion.js';
import { PROFILE_ID } from './_lib/constants.js';

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
        const { projectId, taskName } = await req.json();

        if (!projectId || !taskName) {
            return Response.json({ error: 'Missing projectId or taskName' }, { status: 400, headers: corsHeaders });
        }

        const todayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Cairo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        const projectPage = await notion.pages.retrieve({ page_id: projectId }) as any;
        const projectProps = projectPage.properties;

        const zonesRelation = projectProps['Zones']?.relation || [];
        const importance = projectProps['Importance']?.select?.name || 'Not Important';
        const urgency = projectProps['Urgency']?.select?.name || 'Not Urgent';

        const response = await notion.pages.create({
            parent: { database_id: DATABASE_IDS.TASKS },
            icon: { emoji: '☑' as any },
            properties: {
                'Task Name': { title: [{ text: { content: taskName } }] },
                'Status': { status: { name: 'Not started' } },
                'Project': { relation: [{ id: projectId }] },
                'Zone': { relation: zonesRelation.map((z: any) => ({ id: z.id })) },
                'Importance': { select: { name: importance } },
                'Urgency': { select: { name: urgency } },
                'Due Date': { date: { start: todayStr } },
                'Profile': { relation: [{ id: PROFILE_ID }] }
            }
        });

        return Response.json({ success: true, taskId: response.id }, { headers: corsHeaders });
    } catch (error: any) {
        console.error('Add Task Error:', error);
        return Response.json(
            { error: 'Failed to add task', details: String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}
