import { notion } from './_lib/notion.js';

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
        const { habit_id, action } = await req.json();

        if (!habit_id || action !== 'toggle') {
            return Response.json({ error: 'Invalid parameters' }, { status: 400, headers: corsHeaders });
        }

        const page: any = await notion.pages.retrieve({ page_id: habit_id });
        const currentStatus = page.properties.Done?.checkbox;

        await notion.pages.update({
            page_id: habit_id,
            properties: {
                'Done': { checkbox: !currentStatus }
            }
        });

        return Response.json({ success: true, newStatus: !currentStatus }, { headers: corsHeaders });
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
