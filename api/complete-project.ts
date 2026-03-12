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
        const { projectId } = await req.json();

        if (!projectId) {
            return Response.json({ error: 'Project ID is required' }, { status: 400, headers: corsHeaders });
        }

        const today = new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Africa/Cairo', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(new Date());

        // 1. Mark Project as Completed
        await notion.pages.update({
            page_id: projectId,
            properties: {
                'Status': {
                    status: {
                        name: 'Completed'
                    }
                },
                'Completed Date': {
                    date: {
                        start: today
                    }
                }
            }
        });

        // 2. CASCADE: Mark all tasks linked to this project as Completed
        try {
            const taskDbId = '207f2317-55ae-8141-9dba-c847715bc9e1';
            const relatedTasks = await notion.databases.query({
                database_id: taskDbId,
                filter: {
                    and: [
                        {
                            property: 'Project',
                            relation: {
                                contains: projectId
                            }
                        },
                        {
                            property: 'Status',
                            status: {
                                does_not_equal: 'Completed'
                            }
                        }
                    ]
                }
            });

            if (relatedTasks.results.length > 0) {
                await Promise.all(
                    relatedTasks.results.map((task: any) => 
                        notion.pages.update({
                            page_id: task.id,
                            properties: {
                                'Status': {
                                    status: {
                                        name: 'Completed'
                                    }
                                },
                                'Completed Date': {
                                    date: {
                                        start: today
                                    }
                                }
                            }
                        })
                    )
                );
            }
        } catch (cascadeError) {
            console.error('Cascade Tasks Update Error (Non-Fatal):', cascadeError);
        }

        return Response.json({ success: true }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('Complete Project Error:', error);
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
