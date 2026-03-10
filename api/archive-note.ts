import { notion } from './_lib/notion.js';
import { z } from 'zod';

const BodySchema = z.object({
    noteId: z.string().min(1)
});

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
        const { noteId } = BodySchema.parse(body);

        await notion.pages.update({
            page_id: noteId,
            properties: {
                Archive: { checkbox: true }
            }
        });

        return Response.json({ success: true, archived: true }, { headers: corsHeaders });
    } catch (error: any) {
        console.error('Archive Note Error:', error);
        return Response.json(
            { error: 'Failed to archive note', details: error.message || String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}
