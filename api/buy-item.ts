import { notion } from './_lib/notion.js';
import { z } from 'zod';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const BuySchema = z.object({
    itemId: z.string().min(1)
});

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { itemId } = BuySchema.parse(body);

        // 1. Fetch Item Details
        const item = await notion.pages.retrieve({ page_id: itemId }) as any;
        const price = item.properties.Price?.number || 0;
        const isClaimed = item.properties.Checkbox?.checkbox || false;

        if (isClaimed) {
            return Response.json({ error: 'Item already claimed' }, { status: 400, headers: corsHeaders });
        }

        // 2. Fetch User Aura
        // Profile ID is hardcoded for now as per local implementation
        const profile = await notion.pages.retrieve({ page_id: '207f2317-55ae-8153-9da3-ce5cfe4dd0c8' }) as any;
        const auraText = profile.properties['Aura']?.formula?.string || '';
        const totalMatch = auraText.match(/TOTAL\s*:\s*(\d+)/i);
        const userAura = totalMatch ? parseInt(totalMatch[1], 10) : 0;

        // 3. Balance Guard
        if (userAura < price) {
            return Response.json({ error: 'Not enough Aura' }, { status: 400, headers: corsHeaders });
        }

        // 4. Mark as Claimed
        await notion.pages.update({
            page_id: itemId,
            properties: {
                'Checkbox': {
                    checkbox: true
                }
            }
        });

        return Response.json({ success: true, remainingAura: userAura - price }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('Buy Item Error:', error);
        
        if (error instanceof z.ZodError) {
            return Response.json({ success: false, error: 'Invalid Payload', details: error.issues }, { status: 400, headers: corsHeaders });
        }

        return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
    }
}
