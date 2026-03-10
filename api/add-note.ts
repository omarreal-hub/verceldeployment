import { notion } from './_lib/notion.js';
import { z } from 'zod';

const NoteSchema = z.object({
    message: z.object({
        text: z.string().min(1)
    })
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
        const { message } = NoteSchema.parse(body);

        const response = await notion.pages.create({
            parent: { database_id: '207f2317-55ae-8169-b1ba-fbdce796789a' },
            properties: {
                Name: {
                    title: [
                        { text: { content: message.text } }
                    ]
                },
                Status: {
                    status: { name: 'Inbox' }
                }
            }
        });

        return Response.json({ success: true, id: response.id }, { headers: corsHeaders });
    } catch (err: any) {
        return Response.json({ error: err.message || String(err) }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
