import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Check, X } from 'lucide-react';
import './index.css';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import FAB from './components/FAB';
import HomeView from './views/HomeView';
import ShopView from './views/ShopView';
import ProfileView from './views/ProfileView';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'home');
  const [loading, setLoading] = useState(true);
  const [pinnedProjectIds, setPinnedProjectIds] = useState(() => {
    const saved = localStorage.getItem('pinnedProjects');
    return saved ? JSON.parse(saved) : [];
  });
  const lastActionTime = useRef(0);
  const [error, setError] = useState(null);

  // Notification Snackbar State
  const [snackbar, setSnackbar] = useState({ visible: false, message: '', type: 'undo', onUndo: null, submitRef: null });
  const snackbarTimer = useRef(null);

  // Real data state
  const [user, setUser] = useState({}); // Changed from null to {}
  const [habits, setHabits] = useState([]);
  const [projects, setProjects] = useState([]);
  const [shopItems, setShopItems] = useState([]); // NEW

  const fetchData = async () => {
    try {
      const res = await fetch('/api/get-dashboard', { method: 'POST' });
      if (!res.ok) throw new Error('Dashboard fetch failed');
      const data = await res.json();
      
      // SYNC LOCK: Notion API is slow to reflect writes. 
      // If we just performed an action, ignore stale data updates for a few seconds.
      const isLocked = Date.now() - lastActionTime.current < 20000;

      // Cleanup pinned projects: remove IDs that don't exist in the fetched projects
      const fetchedProjectIds = new Set(data.projects.map(p => p.id));
      setPinnedProjectIds(curr => {
        const cleaned = curr.filter(id => fetchedProjectIds.has(id));
        if (cleaned.length !== curr.length) {
          localStorage.setItem('pinnedProjects', JSON.stringify(cleaned));
        }
        return cleaned;
      });

      // Only update habits/projects if not locked (to prevent flicker)
      if (!isLocked) {
        const profile = data.profile || {};
        setUser(u => ({
          ...u,
          name: profile.name || 'Hero',
          avatar: profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'Hero')}&background=7c3aed&color=fff&size=256`,
          level: profile.level?.num || 1,
          levelPct: parseInt(profile.level?.bar) || 0,
          auraTotal: profile.points?.total || 0,
          auraToday: profile.points?.today || 0,
          auraSpentToday: profile.points?.spent || 0,
          recentPurchases: profile.recentPurchases || [],
          joinDate: 'Oct 2023',
          streak: 0,
          longestStreak: 0,
          overdueProjects: profile.overdue?.projects || 0,
          overdueTasks: profile.overdue?.tasks || 0,
          notesToReviewCount: profile.reviewNotes?.count || 0,
          notesToReviewItems: profile.reviewNotes?.items || [],
          yearProgress: parseInt(profile.time?.yearBar) || 0,
          monthProgress: parseInt(profile.time?.monthBar) || 0
        }));

        setHabits(data.habits || []);

        const rawTasks = data.tasks || [];
        const mappedProjects = (data.projects || []).map(p => {
          // ... (mapping logic continues)
          const projectTasks = rawTasks.filter(t => {
            for (const key in t.raw) {
              if (t.raw[key]?.type === 'relation' && t.raw[key].relation.some(r => r.id === p.id)) return true;
            }
            return false;
          }).map(t => ({
            id: t.id,
            title: t.title,
            completed: t.raw.Status?.status?.name === 'Completed',
            isOverdue: t.isOverdue // Mapping from backend processed flag
          }));

          return {
            id: p.id,
            title: p.title,
            name: p.name,
            type: p.type,
            importance: p.importance,
            aura: p.aura,
            zones: p.zones || [],
            isOverdue: p.isOverdue, // Mapping from backend processed flag
            status: p.status,
            completedDate: p.completedDate,
            tasks: projectTasks
          };
        });

        setProjects(mappedProjects);
      }
      
      setShopItems(data.shop || []);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to connect to the automated backend.");
    } finally {
      setLoading(false);
    }
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const pinA = pinnedProjectIds.indexOf(a.id);
      const pinB = pinnedProjectIds.indexOf(b.id);
      
      if (pinA !== -1 && pinB !== -1) return pinA - pinB;
      if (pinA !== -1) return -1;
      if (pinB !== -1) return 1;
      return 0;
    });
  }, [projects, pinnedProjectIds]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 30000); // Sync every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const showSnackbar = useCallback((message, executionFn, rollbackFn) => {
    if (snackbarTimer.current) {
      clearTimeout(snackbarTimer.current);
      if (snackbar.submitRef) snackbar.submitRef();
    }

    const wrappedExecution = async () => {
      lastActionTime.current = Date.now();
      try {
        await executionFn();
        // Delay the silent refresh to give Notion time to sync
        setTimeout(() => fetchData(), 12000);
      } catch (e) { 
        console.error('Silent execution failed', e);
        lastActionTime.current = 0; // Clear lock on error
        fetchData();
      }
    };

    setSnackbar({ visible: true, message, type: 'undo', onUndo: rollbackFn, submitRef: wrappedExecution });

    snackbarTimer.current = setTimeout(() => {
      wrappedExecution();
      setSnackbar(s => ({ ...s, visible: false, submitRef: null }));
      snackbarTimer.current = null;
    }, 4000);
  }, [snackbar.submitRef]);

  const showToast = useCallback((message, type = 'success') => {
    if (snackbarTimer.current) {
      clearTimeout(snackbarTimer.current);
      if (snackbar.submitRef) snackbar.submitRef();
    }

    setSnackbar({ visible: true, message, type, onUndo: null, submitRef: null });

    snackbarTimer.current = setTimeout(() => {
      setSnackbar(s => ({ ...s, visible: false }));
      snackbarTimer.current = null;
    }, 3000);
  }, [snackbar.submitRef]);

  const handleUndo = useCallback(() => {
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    snackbarTimer.current = null;
    if (snackbar.onUndo) snackbar.onUndo();
    setSnackbar(s => ({ ...s, visible: false, submitRef: null }));
  }, [snackbar]);

  const toggleHabit = (id) => {
    lastActionTime.current = Date.now();
    // 1. Optimistic UI update
    setHabits(h => h.map(x => x.id === id ? { ...x, completed: !x.completed } : x));

    // Find the habit to know what it's current state is going to become
    const habit = habits.find(x => x.id === id);
    if (!habit) return;
    const isNowCompleted = !habit.completed;

    const executionFn = async () => {
      await fetch('/api/toggle-habit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit_id: id, action: 'toggle' })
      });
    };

    const rollbackFn = () => {
      // Revert the optimist update
      setHabits(h => h.map(x => x.id === id ? { ...x, completed: !x.completed } : x));
    };

    // 2. Optimistic User Update
    if (isNowCompleted && habit.aura) {
      setUser(u => {
        const nextAura = u.auraTotal + habit.aura;
        const nextToday = u.auraToday + habit.aura;
        // Basic level formula: aura / 100
        const nextLevel = Math.floor(nextAura / 100) + 1;
        const nextLevelPct = nextAura % 100;
        return { ...u, auraTotal: nextAura, auraToday: nextToday, level: nextLevel, levelPct: nextLevelPct };
      });
    }

    showSnackbar(isNowCompleted ? 'Habit marked as done' : 'Habit unchecked', executionFn, rollbackFn);
  };
  const toggleTask = (projectId, taskId) => {
    lastActionTime.current = Date.now();
    // Find the task's current state
    let task = null;
    for (const p of projects) {
      if (p.id === projectId) {
        task = p.tasks.find(t => t.id === taskId);
        break;
      }
    }
    if (!task) return;

    const isNowCompleted = !task.completed;

    // 1. Optimistic UI update
    setProjects(ps => ps.map(p =>
      p.id === projectId
        ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: isNowCompleted } : t) }
        : p
    ));

    const executionFn = async () => {
      const res = await fetch('/api/complete-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: taskId })
      });
      if (!res.ok) throw new Error('Failed to toggle task in backend');
    };

    const rollbackFn = () => {
      // Revert optimistic update
      setProjects(ps => ps.map(p =>
        p.id === projectId
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: !isNowCompleted } : t) }
          : p
      ));
    };

    // 2. Optimistic User Update (Toggling tasks gives a small amount of Aura if your system does that, or at least we can update points)
    // Let's assume tasks give 5 Aura if completed (or check if project has aura shared)
    // Actually, usually projects give the Aura on completion. Let's stick to project completion for level update.

    showSnackbar(isNowCompleted ? 'Task marked as completed' : 'Task unchecked', executionFn, rollbackFn);
  };
  const completeProject = (projectId) => {
    lastActionTime.current = Date.now();
    // 1. Optimistic UI update
    setProjects(ps => ps.map(p =>
      p.id === projectId
        ? { 
            ...p, 
            status: 'Completed', 
            completedDate: new Date().toISOString().split('T')[0],
            tasks: p.tasks.map(t => ({ ...t, completed: true }))
          }
        : p
    ));

    const executionFn = async () => {
      const res = await fetch('/api/complete-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      if (!res.ok) throw new Error('Failed to complete project in backend');
    };

    const rollbackFn = () => {
      // Revert optimistic update (simply re-fetching is safest but let's toggle back local state for immediate feedback)
      setProjects(ps => ps.map(p =>
        p.id === projectId
          ? { ...p, status: 'In progress', completedDate: null, tasks: p.tasks.map(t => ({ ...t, completed: false })) }
          : p
      ));
    };

    // 2. Optimistic User Update
    const project = projects.find(p => p.id === projectId);
    if (project && project.aura) {
      setUser(u => {
        const nextAura = u.auraTotal + project.aura;
        const nextToday = u.auraToday + project.aura;
        const nextLevel = Math.floor(nextAura / 100) + 1;
        const nextLevelPct = nextAura % 100;
        return { ...u, auraTotal: nextAura, auraToday: nextToday, level: nextLevel, levelPct: nextLevelPct };
      });
    }

    showSnackbar('Project marked as completed', executionFn, rollbackFn);
  };

  const togglePin = (projectId) => {
    setPinnedProjectIds(prev => {
      const isPinned = prev.includes(projectId);
      const next = isPinned ? prev.filter(id => id !== projectId) : [...prev, projectId];
      localStorage.setItem('pinnedProjects', JSON.stringify(next));
      return next;
    });
    showToast('Project pinning updated');
  };

  const movePinnedProject = (projectId, direction) => {
    setPinnedProjectIds(prev => {
      const index = prev.indexOf(projectId);
      if (index === -1) return prev;
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      localStorage.setItem('pinnedProjects', JSON.stringify(next));
      return next;
    });
  };

  const handleArchiveNote = async (noteId) => {
    // Optimistic UI for Notes
    setUser(u => ({
      ...u,
      notesToReviewCount: Math.max(0, u.notesToReviewCount - 1),
      notesToReviewItems: u.notesToReviewItems.filter(n => n.id !== noteId)
    }));
    lastActionTime.current = Date.now();
    try {
      const res = await fetch('/api/archive-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId })
      });
      if (!res.ok) throw new Error('API failed');
      // Silently refresh for full sync later
      setTimeout(() => fetchData(), 500);
    } catch (e) {
      console.error('Failed to archive note', e);
      fetchData(); // Rollback on failure
    }
  };

  const handleBuyItem = (item) => {
    lastActionTime.current = Date.now();
    // 1. Optimistic UI update
    setUser(u => {
      const newAuraTotal = Math.max(0, u.auraTotal - item.price);
      const newLevel = Math.floor(newAuraTotal / 100) + 1;
      const newLevelPct = newAuraTotal % 100;

      return {
        ...u,
        auraTotal: newAuraTotal,
        level: newLevel,
        levelPct: newLevelPct,
        auraSpentToday: u.auraSpentToday + item.price,
        recentPurchases: [{
          id: item.id,
          title: item.title,
          price: item.price,
          date: new Date().toISOString()
        }, ...(u.recentPurchases || [])]
      };
    });

    const executionFn = async () => {
      lastActionTime.current = Date.now();
      const res = await fetch('/api/buy-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to buy item');
      }
      setTimeout(() => fetchData(), 8000);
    };

    const rollbackFn = () => {
      // Revert optimistic update
      setUser(u => {
        const revertAuraTotal = u.auraTotal + item.price;
        const revertLevel = Math.floor(revertAuraTotal / 100) + 1;
        const revertLevelPct = revertAuraTotal % 100;

        return {
          ...u,
          auraTotal: revertAuraTotal,
          level: revertLevel,
          levelPct: revertLevelPct,
          auraSpentToday: Math.max(0, u.auraSpentToday - item.price),
          recentPurchases: (u.recentPurchases || []).filter(x => x.id !== item.id)
        };
      });
    };

    showSnackbar(`Purchased ${item.title}!`, executionFn, rollbackFn);
  };

  // Initial load screens
  if (loading && !user.name) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !user.name) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--red)', padding: 20, textAlign: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Connection Lost</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{error}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 16px', background: 'var(--bg-elevated)', borderRadius: 8, color: 'var(--text-primary)' }}>Retry</button>
        </div>
      </div>
    );
  }

  // Derived stats shared with Header & ProfileView
  const habitsDone = habits.filter(h => h.completed).length;
  const totalHabits = habits.length;
  const tasksDone = projects.reduce((a, p) => a + p.tasks.filter(t => t.completed).length, 0);
  const totalTasks = projects.reduce((a, p) => a + p.tasks.length, 0);
  const projectsDone = projects.filter(p => p.tasks.length > 0 && p.tasks.every(t => t.completed)).length;
  const totalProjects = projects.length;

  const showHeader = activeTab !== 'profile';

  const stats = { habitsDone, totalHabits, tasksDone, totalTasks, projectsDone, totalProjects };

  const renderView = () => {
    if (activeTab === 'home')
      return (
        <HomeView
          habits={habits}
          projects={sortedProjects}
          user={user}
          onToggleHabit={toggleHabit}
          onToggleTask={toggleTask}
          onCompleteProject={completeProject}
          pinnedProjectIds={pinnedProjectIds}
          onTogglePin={togglePin}
          onMovePin={movePinnedProject}
        />
      );
    if (activeTab === 'shop')
      return <ShopView user={user} shopItems={shopItems} onBuyItem={handleBuyItem} />;
    if (activeTab === 'profile')
      return <ProfileView habits={habits} projects={projects} stats={stats} user={user} onArchiveNote={handleArchiveNote} />;
    return null;
  };

  return (
    /* overflow-hidden on the root forces the flex child to own its scroll context */
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
    }}>
      {showHeader && <Header {...stats} user={user} />}

      {/*
        flex-1 + minHeight:0 = required in flex context so this div can shrink.
        overflowY:auto       = let THIS element scroll (not the page).
        paddingBottom:128px  = clears the fixed bottom nav (pb-32).
      */}
      <main style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        paddingBottom: '128px',
      }}>
        {activeTab === 'shop' && (
          <div style={{ padding: '18px 18px 12px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Temptations
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Spend your Aura wisely</p>
          </div>
        )}
        <div style={{ padding: '0 14px' }}>
          {renderView()}
        </div>
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
      <FAB
        showSnackbar={showSnackbar}
        showToast={showToast}
        onProjectGenerated={(plan) => {
          const newProject = {
            id: 'temp-' + Date.now(),
            title: plan.project.name,
            name: plan.project.name,
            type: plan.project.type || 'Routine',
            aura: plan.project.aura_value || 0,
            importance: plan.project.importance || 'Not Important',
            tasks: plan.tasks.map((t, idx) => ({
              id: 'temp-task-' + Date.now() + '-' + idx,
              title: t.name,
              name: t.name,
              completed: false
            }))
          };
          setProjects(prev => [newProject, ...prev]);
        }}
      />

      {/* Notification Snackbar */}
      {snackbar.visible && (
        <div style={{
          position: 'fixed',
          bottom: 90,
          left: 20,
          right: 20,
          background: snackbar.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'var(--bg-elevated)',
          backdropFilter: 'blur(10px)',
          border: snackbar.type === 'error' ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-strong)',
          borderRadius: 16,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {snackbar.type === 'success' && <Check size={18} color="var(--green)" />}
            {snackbar.type === 'error' && <X size={18} color="white" />}
            <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>
              {snackbar.message}
            </span>
          </div>
          {snackbar.type === 'undo' && (
            <button
              onClick={handleUndo}
              style={{
                background: 'rgba(167, 139, 250, 0.15)',
                border: 'none',
                color: 'var(--aura)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              UNDO
            </button>
          )}
        </div>
      )}
    </div>
  );
}
