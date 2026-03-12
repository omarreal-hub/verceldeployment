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

        // Fetch page details for properties
        const page: any = await notion.pages.retrieve({ page_id });
        const props = page.properties;

        // Extract title
        let title = '';
        if (props.Name?.title) {
            title = props.Name.title.map((t: any) => t.plain_text).join('');
        } else if (props.title?.title) {
            title = props.title.title.map((t: any) => t.plain_text).join('');
        }

        // Extract specific properties
        const url = props.URL?.url || '';
        const type = props.Type?.select?.name || props.Type?.multi_select?.[0]?.name || props.Type?.status?.name || '';

        let zones = '';
        const zoneRelations = props.Zones?.relation || [];
        if (zoneRelations.length > 0) {
            const zoneTitles = await Promise.all(
                zoneRelations.map(async (rel: any) => {
                    try {
                        const zonePage: any = await notion.pages.retrieve({ page_id: rel.id });
                        const zProps = zonePage.properties;
                        return zProps.Name?.title?.[0]?.plain_text ||
                            zProps.title?.title?.[0]?.plain_text || '';
                    } catch (e) {
                        return null;
                    }
                })
            );
            zones = zoneTitles.filter(Boolean).join(', ');
        } else {
            zones = props.Zones?.multi_select?.map((z: any) => z.name).join(', ') || '';
        }

        // Fetch all blocks from the page
        const blocks = await notion.blocks.children.list({
            block_id: page_id,
        });

        const parsedBlocks = blocks.results.map((block: any) => {
            const type = block.type;
            const content = block[type];

            let text = '';
            if (content?.rich_text) {
                text = content.rich_text.map((t: any) => t.plain_text).join('');
            }

            return {
                id: block.id,
                type,
                text,
                checked: type === 'to_do' ? content.checked : undefined,
            };
        });

        return Response.json({
            success: true,
            title,
            metadata: {
                url,
                type,
                zones
            },
            blocks: parsedBlocks
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('Get Note Error:', error);
        return Response.json({ success: false, error: String(error) }, { status: 500, headers: corsHeaders });
    }
}
