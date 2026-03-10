import { notion } from './_lib/notion.js';
import { z } from 'zod';

const ToggleSchema = z.object({
    habit_id: z.string().min(1),
    action: z.literal('toggle')
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
        const { habit_id } = ToggleSchema.parse(body);

        const page = await notion.pages.retrieve({ page_id: habit_id }) as any;
        const currentValue = page.properties.Done?.checkbox || false;

        await notion.pages.update({
            page_id: habit_id,
            properties: {
                Done: {
                    checkbox: !currentValue
                }
            }
        });

        return Response.json({ success: true, newStatus: !currentValue }, { headers: corsHeaders });
    } catch (err: any) {
        return Response.json({ error: err.message || String(err) }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
