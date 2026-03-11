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
        const { itemId } = await req.json();

        if (!itemId) {
            return Response.json({ error: 'Missing itemId' }, { status: 400, headers: corsHeaders });
        }

        const today = new Date().toISOString().split('T')[0];

        await notion.pages.update({
            page_id: itemId,
            properties: {
                'Claimed': { checkbox: true },
                'Date': { date: { start: today } }
            }
        });

        return Response.json({ success: true }, { headers: corsHeaders });
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
