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
        const { noteId } = await req.json();

        if (!noteId) {
            return Response.json({ error: 'Missing noteId' }, { status: 400, headers: corsHeaders });
        }

        await notion.pages.update({
            page_id: noteId,
            properties: {
                'Archive': { checkbox: true }
            }
        });

        return Response.json({ success: true }, { headers: corsHeaders });
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
