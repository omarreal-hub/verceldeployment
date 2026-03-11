import { notion, DATABASE_IDS, getZones } from './_lib/notion.js';
import { extractNoteWithAI } from './_lib/ai.js';
import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const RequestSchema = z.object({
    text: z.string().optional(),
    message: z.object({
        text: z.string()
    }).optional()
});

export default async function (req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    console.log('[Add Note] Request received');

    try {
        const body = req.body;
        const validated = RequestSchema.parse(body);
        const text = validated.text || validated.message?.text;

        if (!text) {
            console.error('[Add Note] No text provided in request:', body);
            return res.status(400).json({ error: 'Text is required' });
        }

        console.log('[Add Note] Processing text:', text.substring(0, 50) + '...');

        let extracted = {
            title: text.substring(0, 100),
            type: 'Quick Note',
            zone: 'Other',
            summary: text,
            url: ''
        };

        // Attempt AI Extraction with a timeout
        try {
            console.log('[Add Note] Attempting AI extraction...');
            const aiPromise = extractNoteWithAI(text);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI Timeout')), 8000)
            );

            const result = await Promise.race([aiPromise, timeoutPromise]) as any;
            extracted = { ...extracted, ...result };
            console.log('[Add Note] AI extraction successful:', extracted.type, extracted.zone);
        } catch (aiError) {
            console.warn('[Add Note] AI extraction failed or timed out. Falling back to basic note.');
            extracted.title = text.split('\n')[0].substring(0, 100);
        }

        console.log('[Add Note] Fetching zones...');
        const zones = await getZones().catch(err => {
            console.error('[Add Note] Failed to fetch zones:', err);
            return [];
        });
        
        const matchedZone = zones.find(z => 
            z.name.toLowerCase() === (extracted.zone || 'Other').toLowerCase()
        );
        const zoneId = matchedZone?.id || null;

        console.log('[Add Note] Creating Notion page...');
        const properties: any = {
            'Name': { title: [{ text: { content: extracted.title } }] },
            'Status': { status: { name: 'Inbox' } },
            'Type': { select: { name: extracted.type || 'Quick Note' } },
            'Created Date': { date: { start: new Date().toISOString() } },
            'Profile': { relation: [{ id: DATABASE_IDS.PROFILE || '207f2317-55ae-8153-9da3-ce5cfe4dd0c8' }] }
        };

        if (zoneId) {
            properties['Zones'] = { relation: [{ id: zoneId }] };
        }

        if (extracted.url) {
            properties['URL'] = { url: extracted.url };
        }

        const page = await notion.pages.create({
            parent: { database_id: DATABASE_IDS.NOTES },
            icon: { emoji: extracted.type === 'Resource' ? '🔗' : '📒' },
            properties,
            children: [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ type: 'text', text: { content: extracted.summary || text } }]
                    }
                }
            ]
        });

        console.log('[Add Note] Success! Page ID:', page.id);
        return res.status(200).json({ success: true, page_id: page.id, extracted });

    } catch (error) {
        console.error('[Add Note] Terminal error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'Internal server error', details: message });
    }
}
