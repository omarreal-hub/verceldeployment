import { notion } from './_lib/notion.js';
import { z } from 'zod';

const BuySchema = z.object({
    itemId: z.string().min(1)
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
        const { itemId } = BuySchema.parse(body);

        const item = await notion.pages.retrieve({ page_id: itemId }) as any;
        const price = item.properties.Price?.number || 0;
        const isClaimed = item.properties.Checkbox?.checkbox || false;

        if (isClaimed) {
            return Response.json({ error: 'Item already claimed' }, { status: 400, headers: corsHeaders });
        }

        const profile = await notion.pages.retrieve({ page_id: '207f2317-55ae-8153-9da3-ce5cfe4dd0c8' }) as any;
        const auraText = profile.properties['Aura']?.formula?.string || '';
        const totalMatch = auraText.match(/TOTAL\s*:\s*(\d+)/i);
        const userAura = totalMatch ? parseInt(totalMatch[1], 10) : 0;

        if (userAura < price) {
            return Response.json({ error: 'Not enough Aura' }, { status: 400, headers: corsHeaders });
        }

        await notion.pages.update({
            page_id: itemId,
            properties: {
                Checkbox: {
                    checkbox: true
                }
            }
        });

        return Response.json({ success: true, remainingAura: userAura - price }, { headers: corsHeaders });
    } catch (err: any) {
        return Response.json({ error: err.message || String(err) }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
