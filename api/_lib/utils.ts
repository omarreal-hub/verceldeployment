// Utility functions for string mappings and date handling

/**
 * Normalizes 'urgency' from AI to perfectly match Notion Select Options
 */
export function normalizeUrgency(urgency: string): string {
    const clean = urgency.toLowerCase().trim();
    if (clean.includes('not urgent')) return 'Not Urgent';
    if (clean.includes('urgent')) return 'Urgent';
    return 'Not Urgent';
}

/**
 * Normalizes 'importance' from AI to perfectly match Notion Select Options
 */
export function normalizeImportance(importance: string): string {
    const clean = importance.toLowerCase().trim();
    if (clean.includes('not important')) return 'Not Important';
    if (clean.includes('important')) return 'Important';
    return 'Not Important';
}

/**
 * Validates an ISO 8601 string, falls back to today if invalid
 */
export function validateOrProvideDefaultDate(dateStr: string): string {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (regex && dateStr && regex.test(dateStr)) {
        return dateStr;
    }
    return new Date().toISOString().split('T')[0];
}
