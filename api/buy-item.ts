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
        const { itemId } = await req.json();

        if (!itemId) {
            return Response.json({ error: 'Missing itemId' }, { status: 400, headers: corsHeaders });
        }

        // 1. Fetch Item Price
        const item = await notion.pages.retrieve({ page_id: itemId }) as any;
        const price = item.properties.Price?.number || 0;
        const isClaimed = item.properties.Claimed?.checkbox || item.properties.Checkbox?.checkbox || false;

        if (isClaimed) {
            return Response.json({ error: 'Item already claimed' }, { status: 400, headers: corsHeaders });
        }

        // 2. Fetch User Aura (Profile ID)
        const profile = await notion.pages.retrieve({ page_id: '207f2317-55ae-8153-9da3-ce5cfe4dd0c8' }) as any;
        const auraText = profile.properties['Aura']?.formula?.string || '';
        const totalMatch = auraText.match(/TOTAL\s*:\s*(\d+)/i);
        const userAura = totalMatch ? parseInt(totalMatch[1], 10) : 0;

        // 3. Verify enough Aura
        if (userAura < price) {
            return Response.json({ error: 'Not enough Aura' }, { status: 400, headers: corsHeaders });
        }

        // 4. Mark as Claimed & Set Date
        const today = new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Africa/Cairo', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(new Date());

        await notion.pages.update({
            page_id: itemId,
            properties: {
                // Support both property names found in different DB versions
                'Claimed': { checkbox: true },
                'Date': { date: { start: today } }
            }
        });

        return Response.json({ success: true, remainingAura: userAura - price }, { headers: corsHeaders });
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
