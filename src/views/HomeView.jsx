import { useState } from 'react';
import Accordion from '../components/Accordion';
import * as Icons from 'lucide-react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Type badge colour map ─────────────────────────────────────────
const TYPE_COLORS = {
  'QUEST': { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
  'Special Mission': { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  'Routine': { bg: 'rgba(52,211,153,0.1)', color: '#34d399', border: 'rgba(52,211,153,0.2)' },
};

// ─── Premium iOS Glassmorphic Habit Tile ───────────────────────────────
function HabitCard({ habit, onToggle }) {
  const isDone = habit.completed;

  // Try to find an icon based on words in the title, default to Circle
  const titleLower = (habit.title || '').toLowerCase();
  let iconName = 'Circle';
  if (titleLower.includes('meditate') || titleLower.includes('yoga') || titleLower.includes('breathe')) iconName = 'Wind';
  else if (titleLower.includes('workout') || titleLower.includes('gym') || titleLower.includes('exercise')) iconName = 'Dumbbell';
  else if (titleLower.includes('read') || titleLower.includes('book')) iconName = 'BookOpen';
  else if (titleLower.includes('water') || titleLower.includes('drink')) iconName = 'Droplet';
  else if (titleLower.includes('code') || titleLower.includes('program')) iconName = 'Code2';
  else if (titleLower.includes('walk') || titleLower.includes('run')) iconName = 'Footprints';
  else if (titleLower.includes('sleep') || titleLower.includes('bed')) iconName = 'Moon';

  const IconComponent = Icons[habit.icon] || Icons[iconName] || Icons.Circle;

  return (
    <div
      onClick={onToggle}
      className={`group w-full py-2 pl-3 pr-2 rounded-[20px] flex flex-row items-center justify-between transition-all duration-300 cursor-pointer border ${isDone
        ? 'bg-white/[0.03] border-white/[0.05] opacity-50 grayscale'
        : 'bg-white/[0.06] backdrop-blur-md border-white/[0.08] shadow-lg shadow-black/20 hover:bg-white/[0.09] hover:-translate-y-[1px]'
        }`}
    >
      {/* Left Group: Icon Box & Name */}
      <div className="flex flex-row items-center gap-2.5 min-w-0">
        {/* Soft Glowing Icon Box */}
        <div className={`habit-icon-box w-[40px] h-[40px] rounded-[14px] flex shrink-0 items-center justify-center transition-all duration-300 border ${isDone
          ? 'bg-white/[0.05] border-white/[0.1]'
          : `${habit.bg || 'bg-white/[0.08]'} ${habit.border || 'border-white/[0.12]'} ${habit.color || 'text-white'} shadow-[0_0_15px_-4px_rgba(0,0,0,0.3)]`
          }`} style={{ color: isDone ? 'var(--text-muted)' : undefined }}>
          <IconComponent size={18} strokeWidth={2.5} className={isDone ? 'opacity-40' : 'drop-shadow-sm'} />
        </div>

        {/* Habit Name */}
        <span className={`habit-name text-[14px] font-medium tracking-tight transition-all duration-300 truncate`} style={{ color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
          {habit.title}
        </span>
      </div>

      {/* Luxurious Square Aura Badge */}
      <div className={`habit-aura-badge shrink-0 ml-2 w-10 h-10 rounded-[14px] flex flex-col items-center justify-center transition-all duration-500 aura-card ${isDone
        ? 'opacity-30 grayscale border-white/5 bg-white/5'
        : ''
        }`}>
        <Icons.Sparkles
          size={11}
          className={`${isDone ? 'sparkle-done text-purple-400' : 'opacity-40 mb-0.5 text-purple-400'} transition-all`}
        />
        <span className={`text-[11px] font-bold`} style={{ color: isDone ? 'var(--text-muted)' : 'var(--aura)' }}>
          {habit.aura ?? 0}
        </span>
      </div>
    </div>
  );
}

// ─── Checkbox task row (inside project cards) ─────────────────────
function CheckItem({ label, checked, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: '1px solid var(--border-subtle)',
      cursor: 'pointer',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 6, flexShrink: 0,
        border: checked ? 'none' : '2px solid var(--border)',
        background: checked ? 'var(--accent)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
      }}>
        {checked && <Check size={11} color="white" strokeWidth={3.5} />}
      </div>
      <span style={{
        flex: 1, fontSize: 13.5, fontWeight: checked ? 400 : 500,
        color: checked ? 'var(--text-muted)' : 'var(--text-primary)',
        textDecoration: checked ? 'line-through' : 'none',
        transition: 'all 0.2s ease',
      }}>{label}</span>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────
function ProjectCard({ project, onToggleTask, onComplete, pinnedProjectIds, onTogglePin, onMovePin }) {
  const [tasksOpen, setTasksOpen] = useState(false);
  const isPinned = pinnedProjectIds.includes(project.id);
  const orderIndex = pinnedProjectIds.indexOf(project.id);
  const isFirst = orderIndex === 0;
  const isLast = orderIndex === pinnedProjectIds.length - 1;

  const style = TYPE_COLORS[project.type] || TYPE_COLORS['Routine'];
  const done = project.tasks.filter(t => t.completed).length;
  const total = project.tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isCompleted = project.status === 'Completed';

  return (
    <div style={{
      borderRadius: 16, background: 'var(--bg-elevated)',
      border: '1px solid var(--border-strong)', overflow: 'hidden',
      opacity: isCompleted ? 0.7 : 1,
      transition: 'all 0.3s ease'
    }}>
      <div style={{ padding: '14px 16px 12px' }}>
        <div className="proj-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
          {/* Left: Title & Status */}
          <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text-primary)', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span className="proj-title" style={{ textDecoration: isCompleted ? 'line-through' : 'none' }}>
              {project.name}
            </span>
            {project.isOverdue && !isCompleted && (
              <span className="overdue-pill">
                <Icons.AlertCircle size={10} strokeWidth={3} />
                <span className="hide-on-mobile">Overdue</span>
              </span>
            )}
            {isCompleted && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green-dim)'
              }}>
                Done
              </span>
            )}
          </div>

          {/* Right: Metadata (Importance & Pinning) - Aligned to right */}
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
            {project.importance && project.importance !== 'Normal' && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 7,
                background: project.importance === 'Urgent' || project.importance === 'Important' ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
                color: project.importance === 'Urgent' || project.importance === 'Important' ? '#ef4444' : 'var(--text-secondary)',
                border: `1px solid ${project.importance === 'Urgent' || project.importance === 'Important' ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                <Icons.AlertTriangle size={10} />
                <span className="hide-on-mobile">{project.importance}</span>
              </span>
            )}

            {!isCompleted && (
              <div style={{ display: 'flex', gap: 4 }}>
                {isPinned && !isFirst && (
                  <button onClick={(e) => { e.stopPropagation(); onMovePin(project.id, 'up'); }} title="Move Up" style={{
                    width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer'
                  }}>
                    <Icons.ChevronUp size={14} />
                  </button>
                )}
                {isPinned && !isLast && (
                  <button onClick={(e) => { e.stopPropagation(); onMovePin(project.id, 'down'); }} title="Move Down" style={{
                    width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer'
                  }}>
                    <Icons.ChevronDown size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePin(project.id); }}
                  className="group"
                  title={isPinned ? "Unpin" : "Pin to top"}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 8,
                    background: isPinned ? 'var(--aura-dim)' : 'var(--bg-card)',
                    color: isPinned ? 'var(--aura)' : 'var(--text-secondary)',
                    border: `1px solid ${isPinned ? 'rgba(167,139,250,0.4)' : 'var(--border)'}`,
                    cursor: 'pointer', outline: 'none', transition: 'all 0.2s',
                    padding: 0
                  }}
                >
                  <Icons.Pin size={13} fill={isPinned ? "var(--aura)" : "none"} strokeWidth={isPinned ? 2.5 : 2} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Action Line (Shortened for Mobile) */}
        <div className="proj-meta" style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, alignItems: 'center', minWidth: 0 }}>
            {/* Shortened Type Label */}
            <span style={{
              fontSize: 10, fontWeight: 750, letterSpacing: '0.04em',
              padding: '3px 8px', borderRadius: 7,
              background: style.bg, color: style.color, border: `1px solid ${style.border}`,
              textTransform: 'uppercase', whiteSpace: 'nowrap'
            }}>
              <span className="hide-on-mobile">{project.type}</span>
              <span className="show-on-mobile">
                {project.type === 'QUEST' ? 'Q' : project.type === 'Special Mission' ? 'M' : project.type.substring(0, 1)}
              </span>
            </span>

            {/* Aura Tag - Icon only on mobile */}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 7,
              background: 'var(--aura-dim)', color: 'var(--aura)',
              border: '1px solid rgba(167,139,250,0.25)',
              display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap'
            }}>
              ✦ {project.aura} <span className="hide-on-mobile">Aura</span>
            </span>

            {project.zones && project.zones.length > 0 && (
              <span className="hide-on-mobile" style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 7,
                background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
              }}>
                <Icons.LayoutGrid size={10} />
                {project.zones[0]}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, shrink: 0 }}>
            {!isCompleted && (
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(project.id); }}
                className="group"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                  background: 'var(--bg-card)', color: 'var(--text-primary)',
                  border: '1px solid var(--border)', cursor: 'pointer', outline: 'none',
                  transition: 'all 0.2s', whiteSpace: 'nowrap'
                }}
              >
                <Icons.CheckCircle2 size={12} className="group-hover:text-green-400 transition-colors" />
                <span className="hide-on-mobile">Done</span>
              </button>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); setTasksOpen(o => !o); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 10.5, fontWeight: 700, padding: '4px 12px', borderRadius: 8,
                background: done === total && total > 0 ? 'var(--green-dim)' : 'var(--bg-card)',
                color: done === total && total > 0 ? 'var(--green)' : 'var(--text-secondary)',
                border: `1px solid ${done === total && total > 0 ? 'var(--green-dim)' : 'var(--border)'}`,
                cursor: 'pointer', outline: 'none', transition: 'all 0.2s ease',
              }}
            >
              {done}/{total}
              <ChevronDown size={11} style={{
                transition: 'transform 0.25s ease',
                transform: tasksOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }} />
            </button>
          </div>
        </div>
        {pct > 0 && (
          <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: 'var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, width: `${pct}%`,
              background: isCompleted ? 'var(--green)' : 'linear-gradient(90deg, var(--accent), var(--aura))',
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: tasksOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {project.tasks.map(task => (
              <CheckItem key={task.id} label={task.title}
                checked={task.completed} onToggle={() => onToggleTask(project.id, task.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Highlight Card (Greeting + Ring + Habits list) ───────────────
function HighlightCard({ habits, onToggleHabit, user }) {
  const [isHabitsExpanded, setIsHabitsExpanded] = useState(false);

  // 1-Column Responsive Grid Settings
  const INITIAL_SLOTS = 4;
  const uncompleted = habits.filter(h => !h.completed);
  const completed = habits.filter(h => h.completed);
  const visible = isHabitsExpanded
    ? [...uncompleted, ...completed]
    : [...uncompleted, ...completed].slice(0, INITIAL_SLOTS);
  const hiddenCount = habits.length - INITIAL_SLOTS;

  // Progress logic
  const total = habits.length;
  const done = completed.length;
  const progress = total === 0 ? 0 : (done / total) * 100;

  // SVG Ring params
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div style={{
      borderRadius: 28,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-strong)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      padding: '24px 16px 20px 16px',
    }}>
      {/* Dynamic Greeting Header (No Ring) */}
      <div className="flex flex-row items-center justify-between mb-8 px-2">
        <div className="flex flex-col gap-1.5 items-start">
          <div className="text-[17px] font-semibold tracking-tight text-white/95 leading-tight">
            Ready to conquer today, {user?.name ? user.name.split(' ')[0] : 'Hero'}?
          </div>
          {/* Spacer to maintain layout balance after removing progress text */}
          <div style={{ height: '18px' }} />
        </div>
      </div>

      {/* Habits 2-col Grid Stack with Fade-Out wrapper */}
      <div className="relative">
        <div className={`grid grid-cols-2 gap-2.5 pb-2 ${!isHabitsExpanded ? 'overflow-hidden' : ''}`}>
          {visible.map(h => (
            <HabitCard key={h.id} habit={h} onToggle={() => onToggleHabit(h.id)} />
          ))}
        </div>

        {/* The Magic Gradient fade effect */}
        {!isHabitsExpanded && habits.length > INITIAL_SLOTS && (
          <div
            className="absolute bottom-0 left-0 w-full h-24 pointer-events-none rounded-b-[32px]"
            style={{ background: 'linear-gradient(to top, rgba(11,11,14,1) 0%, rgba(11,11,14,0) 100%)' }}
          />
        )}
      </div>

      {/* Show all / collapse toggle */}
      {habits.length > INITIAL_SLOTS && (
        <div className="w-full flex justify-center items-center mt-3">
          <button
            onClick={() => setIsHabitsExpanded(!isHabitsExpanded)}
            className="group px-6 py-2 rounded-full flex items-center justify-center gap-2 text-[13.5px] font-semibold transition-all duration-300 border border-white/[0.05] hover:border-white/[0.12]"
            style={{ color: 'var(--text-secondary)', background: 'transparent' }}
          >
            {isHabitsExpanded ? 'Show less' : `Show all ${habits.length} habits`}
            <ChevronDown size={14} strokeWidth={2.5} className={`transition-transform duration-300 ${isHabitsExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Home View ────────────────────────────────────────────────────
export default function HomeView({ habits, projects, user, onToggleHabit, onToggleTask, onCompleteProject, pinnedProjectIds, onTogglePin, onMovePin }) {
  const activeProjects = projects.filter(p => {
    return p.status !== 'Completed';
  });
  
  const completedToday = projects.filter(p => {
    return p.status === 'Completed';
  });

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 14 }}>

      {/* 1. Highlight Card: Greeting + Habits */}
      <HighlightCard habits={habits} onToggleHabit={onToggleHabit} user={user} />

      {/* 2. Today date header / divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
          textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap',
        }}>
          TODAY — {today.toUpperCase()}
        </span>
        <div style={{ height: 1, flex: 1, background: 'var(--border-subtle)' }} />
      </div>

      {/* 3. Active Projects */}
      <Accordion title="Active Projects" icon="📁" badge={`${activeProjects.length}`} defaultOpen={true}>
        <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeProjects.map(p => (
            <ProjectCard 
              key={p.id} 
              project={p} 
              onToggleTask={onToggleTask} 
              onComplete={onCompleteProject} 
              pinnedProjectIds={pinnedProjectIds}
              onTogglePin={onTogglePin}
              onMovePin={onMovePin}
            />
          ))}
          {activeProjects.length === 0 && (
            <div className="py-4 text-center text-[13px] text-white/20 font-medium italic">
              No active projects for now...
            </div>
          )}
        </div>
      </Accordion>

      {/* 4. Completed Today */}
      {completedToday.length > 0 && (
        <Accordion title="Completed Today" icon="✅" badge={`${completedToday.length}`} defaultOpen={false}>
          <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {completedToday.map(p => (
              <ProjectCard 
                key={p.id} 
                project={p} 
                onToggleTask={onToggleTask} 
                onComplete={onCompleteProject} 
                pinnedProjectIds={pinnedProjectIds}
                onTogglePin={onTogglePin}
                onMovePin={onMovePin}
              />
            ))}
          </div>
        </Accordion>
      )}
    </div>
  );
}
