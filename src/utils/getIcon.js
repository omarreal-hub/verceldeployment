export function getIconName(text) {
  const t = (text || '').toLowerCase();
  
  // Smart/AI (Catch this early to avoid 'smartphone' overlap)
  if (/smart|ai\b|bot|intelligence|automation/.test(t)) return 'Sparkles';
  
  // Video/streaming
  if (/youtube|netflix|watch|movie|film|cinema|video|stream(?!line)|tv|series|episode|show|documentary|anime|hulu|disney/.test(t)) return 'Tv';

  // Food
  if (/pizza|food|takeout|order(?!.*(task|project))|eat|meal|restaurant|burger|sandwich|sushi|delivery|cook|recipe|lunch|dinner|breakfast|snack/.test(t)) return 'Pizza';
  if (/dessert|cake|sugar|chocolate|ice\s*cream|sweet|candy|pastry|donut|cookie/.test(t)) return 'IceCream';
  if (/coffee|latte|cappuccino|espresso|caffeine|brew/.test(t)) return 'Coffee';
  if (/drink|juice|tea|water|smoothie|soda|beverage/.test(t)) return 'GlassWater';

  // Gaming
  if (/game|play(?!list)|gaming|xbox|playstation|steam|esports|controller|nintendo|console|gamer/.test(t)) return 'Gamepad2';

  // Social/phone
  if (/social|scroll|instagram|twitter|tiktok|reddit|browse|phone|smartphone|facebook|snapchat|whatsapp|telegram|discord/.test(t)) return 'Smartphone';

  // Rest/sleep
  if (/\bnap\b|rest|sleep|bed|relax|chill|break|tired|couch|lazy|lounge/.test(t)) return 'Bed';

  // Fitness
  if (/gym|workout|exercise|run(?!time)|jog|walk|sport|training|yoga|stretch|swim|cycling|weights|dumbbell|skip\s*gym|fitness|pushup|squat|plank|cardio/.test(t)) return 'Dumbbell';

  // Productivity/work
  if (/work|task|project|meeting|email|report|presentation|deadline|office|client|call|zoom|agenda|schedule|standup|sprint/.test(t)) return 'Briefcase';

  // Learning/languages
  if (/english|language|translate|arabic|french|spanish|japanese|chinese|instruction/.test(t)) return 'Languages';
  if (/study|learn|read|book|course|class|lecture|tutorial|research|notes|exam|practice|homework|school|university|academy/.test(t)) return 'BookOpen';

  // Writing
  if (/write|essay|journal|blog|script|poem|story/.test(t)) return 'PencilLine';

  // Bypass/Penalty
  if (/bypass|penalty|skip|ignore/.test(t)) return 'ShieldAlert';

  // Health/medical
  if (/doctor|medicine|pill|health|therapy|meditation|breathe|mental|hospital|appointment|checkup|dentist|vitamin|wellness/.test(t)) return 'Heart';

  // Finance
  if (/money|budget|bank|payment|invoice|salary|invest|expense|bill|transfer|saving|finance|accounting|tax|crypto/.test(t)) return 'Wallet';

  // Travel
  if (/travel|trip|flight|hotel|pack|airport|visa|booking|vacation|holiday|road\s*trip|tour|passport|luggage/.test(t)) return 'Plane';

  // Creative
  if (/design|draw|art|music|guitar|piano|sing|record|edit|photo|video\s*edit|podcast|paint|sketch|card|craft|creative|compose/.test(t)) return 'Palette';

  // Code/tech
  if (/code|program|debug|deploy|github|api|database|server|dev|app|website|build|software|terminal|compile|frontend|backend/.test(t)) return 'Code2';

  // Testing
  if (/test|experiment|demo|trial/.test(t)) return 'FlaskConical';

  // Shopping
  if (/shop|buy|purchase|store|mall|cart|market|retail/.test(t)) return 'ShoppingCart';

  // Cleaning/home
  if (/clean|laundry|dishes|tidy|organize|declutter|chore|vacuum|mop|dusting/.test(t)) return 'Sparkles';

  // Communication
  if (/chat|message|text|reply|respond|communicate|conversation/.test(t)) return 'MessageCircle';

  return 'Package';
}
