import { notion } from './_lib/notion.js';
import { z } from 'zod';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ProjectSchema = z.object({
    projectId: z.string().min(1)
});

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { projectId } = ProjectSchema.parse(body);

        console.log(`[API] Received request to complete project: ${projectId}`);

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

        console.log(`[API] Marked project ${projectId} as Completed`);

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
                console.log(`[API] Cascading completion to ${relatedTasks.results.length} tasks`);
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
            console.error('[API] Cascade Tasks Update Error (Non-Fatal):', cascadeError);
        }

        return Response.json({ success: true }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('[API ERROR completing project]', error);
        
        if (error instanceof z.ZodError) {
            return Response.json({ success: false, error: 'Invalid Payload', details: error.errors }, { status: 400, headers: corsHeaders });
        }

        return Response.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500, headers: corsHeaders });
    }
}
