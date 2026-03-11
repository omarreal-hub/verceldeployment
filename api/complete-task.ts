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
        const { page_id } = await req.json();

        if (!page_id) {
            return Response.json({ error: 'Missing page_id' }, { status: 400, headers: corsHeaders });
        }

        const page: any = await notion.pages.retrieve({ page_id });
        const currentStatus = page.properties.Status?.status?.name;
        const newStatus = currentStatus === 'Completed' ? 'Not started' : 'Completed';
        const today = new Date().toISOString().split('T')[0];

        await notion.pages.update({
            page_id,
            properties: {
                'Status': { status: { name: newStatus } },
                'Completed Date': newStatus === 'Completed' ? { date: { start: today } } : { date: null } as any
            }
        });

        return Response.json({ success: true, newStatus }, { headers: corsHeaders });
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
