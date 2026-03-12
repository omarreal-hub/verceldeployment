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

        // Update the 'Archive' property to true
        await notion.pages.update({
            page_id: noteId,
            properties: {
                Archive: { checkbox: true }
            }
        });

        return Response.json({ success: true, archived: true }, { headers: corsHeaders });
    } catch (error) {
        console.error('Archive Note Error:', error);
        return Response.json(
            { error: 'Failed to archive note', details: String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}
