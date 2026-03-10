import { notion } from './_lib/notion.js';
import { z } from 'zod';

const RequestSchema = z.object({
    page_id: z.string().min(5, "A valid Notion page_id is required."),
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
        const { page_id } = RequestSchema.parse(body);

        const page = await notion.pages.retrieve({ page_id: page_id }) as any;
        const currentStatus = page.properties.Status?.status?.name;
        const isCompleted = currentStatus === 'Completed';

        const response = await notion.pages.update({
            page_id: page_id,
            properties: {
                'Status': { status: { name: isCompleted ? 'In progress' : 'Completed' } },
                'Completed Date': isCompleted ? { date: null } : { date: { start: new Date().toISOString() } }
            }
        });

        return Response.json({
            success: true,
            message: `Task successfully marked as ${isCompleted ? 'In progress' : 'Completed'}.`,
            page_id: response.id,
            newStatus: isCompleted ? 'In progress' : 'Completed'
        }, { headers: corsHeaders });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return Response.json({ success: false, error: 'Invalid Payload', details: error.errors }, {
                status: 400,
                headers: corsHeaders
            });
        }

        return Response.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500, headers: corsHeaders });
    }
}
