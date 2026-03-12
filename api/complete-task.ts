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
            return Response.json({ success: false, error: 'Missing page_id' }, { status: 400, headers: corsHeaders });
        }

        const page: any = await notion.pages.retrieve({ page_id });
        const currentStatus = page.properties.Status?.status?.name === 'Completed';

        await notion.pages.update({
            page_id,
            properties: {
                Status: {
                    status: {
                        name: currentStatus ? 'In progress' : 'Completed'
                    }
                }
            }
        });

        return Response.json({ success: true, completed: !currentStatus }, { headers: corsHeaders });
    } catch (error: any) {
        console.error('Complete Task Error:', error);
        return Response.json({ success: false, error: String(error) }, { status: 500, headers: corsHeaders });
    }
}
