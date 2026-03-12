import { notion } from './_lib/notion.js';
import { z } from 'zod';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const RequestSchema = z.object({
    page_id: z.string().min(5, "A valid Notion page_id is required."),
});

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { page_id } = RequestSchema.parse(body);

        console.log(`[API] Received request to complete task: ${page_id}`);

        // 1. Fetch current status to toggle
        const page = await notion.pages.retrieve({ page_id: page_id }) as any;
        const currentStatus = page.properties.Status?.status?.name;
        const isCompleted = currentStatus === 'Completed';

        const today = new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Africa/Cairo', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(new Date());

        // 2. Toggle status
        const response = await notion.pages.update({
            page_id: page_id,
            properties: {
                'Status': { status: { name: isCompleted ? 'In progress' : 'Completed' } },
                'Completed Date': isCompleted ? { date: null } : { 
                    date: { start: today } 
                }
            }
        });

        console.log(`[API] Successfully toggled task: ${response.id} to ${isCompleted ? 'In progress' : 'Completed'}`);

        return Response.json({
            success: true,
            completed: !isCompleted,
            newStatus: isCompleted ? 'In progress' : 'Completed'
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('[API ERROR completing task]', error);
        
        if (error instanceof z.ZodError) {
            return Response.json({ success: false, error: 'Invalid Payload', details: error.issues }, { status: 400, headers: corsHeaders });
        }

        return Response.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500, headers: corsHeaders });
    }
}
