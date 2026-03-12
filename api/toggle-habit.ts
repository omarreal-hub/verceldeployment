import { notion } from './_lib/notion.js';
import { z } from 'zod';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ToggleSchema = z.object({
  habit_id: z.string().min(1),
  action: z.literal('toggle')
});

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { habit_id } = ToggleSchema.parse(body);

        console.log(`[API] Received request to toggle habit: ${habit_id}`);

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

        console.log(`[API] Successfully toggled habit: ${habit_id} to ${!currentValue}`);

        return Response.json({ success: true, newStatus: !currentValue }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('[API ERROR toggling habit]', error);
        
        if (error instanceof z.ZodError) {
            return Response.json({ success: false, error: 'Invalid Payload', details: error.issues }, { status: 400, headers: corsHeaders });
        }

        return Response.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500, headers: corsHeaders });
    }
}
