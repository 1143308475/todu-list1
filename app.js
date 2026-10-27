const TODO_STORAGE_KEY = 'plan-space-v1-todos';
const HABIT_STORAGE_KEY = 'plan-space-v1-habits';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
const localDateKey = (value = new Date()) => { const d = value instanceof Date ? value : new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const formatTime = value => new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatDay = value => new Date(`${value}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });

let todos = readStore(TODO_STORAGE_KEY, []);
let habits = readStore(HABIT_STORAGE_KEY, []).map(habit => ({ ...habit, logs: Array.isArray(habit.logs) ? habit.logs : [], mode: habit.mode === 'multiple' ? 'multiple' : 'single', goalType: habit.goalType === 'count' ? 'count' : 'days', goalTarget: Math.max(1, Number(habit.goalTarget) || 1), updatedAt: habit.updatedAt || habit.createdAt || Date.now() }));
let filter = 'all';
let selectedHabitId = habits[0]?.id || null;
let editingHabitId = null;

const todoForm = document.querySelector('#todoForm');
const titleInput = document.querySelector('#todoTitle');
const dueInput = document.querySelector('#todoDue');
const todoList = document.querySelector('#todoList');
const emptyState = document.querySelector('#emptyState');
const editDialog = document.querySelector('#editDialog');
const editForm = document.querySelector('#editForm');

function saveTodos() { localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos)); }
function saveHabits() { localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(habits)); }
function formatDue(value) { if (!value) return '无结束时间'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '无结束时间' : `截止 ${date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`; }
function isOverdue(todo) { return !todo.done && todo.due && new Date(todo.due) < new Date(); }
function isSoon(todo) { return !todo.done && todo.due && new Date(todo.due) >= new Date() && new Date(todo.due) - Date.now() < 86400000; }

function renderTodos() {
  const visible = todos.filter(todo => filter === 'all' || (filter === 'active' && !todo.done) || (filter === 'completed' && todo.done));
  todoList.innerHTML = '';
  visible.forEach((todo, index) => {
    const item = document.querySelector('#todoTemplate').content.firstElementChild.cloneNode(true);
    item.classList.toggle('completed', todo.done); item.classList.toggle('overdue', isOverdue(todo)); item.style.animationDelay = `${Math.min(index * 35, 210)}ms`;
    item.querySelector('h3').textContent = todo.title; item.querySelector('.due-date').textContent = formatDue(todo.due); item.querySelector('.due-date').classList.toggle('soon', isSoon(todo) || isOverdue(todo)); item.querySelector('.status-pill').textContent = isOverdue(todo) ? '已逾期' : '';
    const check = item.querySelector('.check-btn'); check.setAttribute('aria-label', todo.done ? '标记为未完成' : '标记完成'); check.setAttribute('aria-pressed', String(todo.done)); check.addEventListener('click', () => { todo.done = !todo.done; saveTodos(); renderTodos(); });
    item.querySelector('.edit-btn').addEventListener('click', () => openTodoEdit(todo.id)); item.querySelector('.delete-btn').addEventListener('click', () => { todos = todos.filter(entry => entry.id !== todo.id); saveTodos(); renderTodos(); }); todoList.append(item);
  });
  const done = todos.filter(todo => todo.done).length; const percent = todos.length ? Math.round(done / todos.length * 100) : 0;
  document.querySelector('#progressText').textContent = `${percent}%`; document.querySelector('#progressBar').style.width = `${percent}%`; document.querySelector('#progressCount').textContent = `${done} / ${todos.length} 已完成`;
  document.querySelector('#allCount').textContent = todos.length; document.querySelector('#activeCount').textContent = todos.filter(todo => !todo.done).length; document.querySelector('#completedCount').textContent = done;
  emptyState.hidden = visible.length !== 0; document.querySelector('#emptyTitle').textContent = filter === 'completed' ? '还没有已完成的计划' : filter === 'active' ? '太棒了，暂时没有进行中的计划' : '还没有计划'; document.querySelector('#emptyMessage').textContent = filter === 'all' ? '先添加一件想完成的事情吧。' : '切换到其他分类看看吧。';
}
function openTodoEdit(id) { const todo = todos.find(entry => entry.id === id); if (!todo) return; editDialog.dataset.id = id; document.querySelector('#editTitle').value = todo.title; document.querySelector('#editDue').value = todo.due || ''; editDialog.showModal(); }

function countByDay(habit) { return habit.logs.reduce((map, log) => { const key = localDateKey(log.at || log); map[key] = (map[key] || 0) + 1; return map; }, {}); }
function todayCount(habit) { return countByDay(habit)[localDateKey()] || 0; }
function goalProgress(habit) { if (habit.goalType === 'days') return new Set(habit.logs.map(log => localDateKey(log.at || log))).size; return habit.logs.length; }
function goalText(habit) { const progress = goalProgress(habit); return `${progress} / ${habit.goalTarget} ${habit.goalType === 'days' ? '天' : '次'}`; }
function openHabitDialog(id = null) {
  editingHabitId = id; const habit = habits.find(entry => entry.id === id);
  document.querySelector('#habitDialogEyebrow').textContent = habit ? 'EDIT CHECK-IN' : 'NEW CHECK-IN'; document.querySelector('#habitDialogTitle').textContent = habit ? '编辑打卡项' : '新建打卡项';
  document.querySelector('#habitName').value = habit?.name || ''; document.querySelector('#habitMode').value = habit?.mode || 'single'; document.querySelector('#habitGoalType').value = habit?.goalType || 'days'; document.querySelector('#habitGoalTarget').value = habit?.goalTarget || 30;
  const dialog = document.querySelector('#habitDialog'); if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); document.querySelector('#habitName').focus();
}
function renderHabits() {
  const list = document.querySelector('#habitList'); list.innerHTML = ''; document.querySelector('#habitCountLabel').textContent = `${habits.length} 项`; document.querySelector('#habitEmpty').hidden = habits.length !== 0;
  if (!habits.some(habit => habit.id === selectedHabitId)) selectedHabitId = habits[0]?.id || null;
  habits.forEach((habit, index) => {
    const item = document.querySelector('#habitTemplate').content.firstElementChild.cloneNode(true); const progress = goalProgress(habit); const percent = Math.min(100, Math.round(progress / habit.goalTarget * 100)); const today = todayCount(habit);
    item.classList.toggle('selected', habit.id === selectedHabitId); item.style.animationDelay = `${Math.min(index * 35, 210)}ms`; item.querySelector('.habit-name').textContent = habit.name; item.querySelector('.mode-label').textContent = habit.mode === 'multiple' ? '每天可多次' : '每天一次'; item.querySelector('.updated-label').textContent = `目标更新于 ${formatTime(habit.updatedAt)}`;
    item.querySelector('.goal-label').textContent = `目标：${goalText(habit)}`; item.querySelector('.goal-percent').textContent = `${percent}%`; item.querySelector('.habit-progress-bar').style.width = `${percent}%`;
    item.querySelector('.today-label').textContent = habit.mode === 'single' ? (today ? '今天已完成' : '今天还未打卡') : `今天已打卡 ${today} 次`;
    const checkButton = item.querySelector('.checkin-btn'); checkButton.textContent = habit.mode === 'single' && today ? '今日已完成' : '今日打卡'; checkButton.disabled = habit.mode === 'single' && today > 0; checkButton.addEventListener('click', event => { event.stopPropagation(); checkIn(habit.id); });
    item.querySelector('.habit-select').addEventListener('click', () => { selectedHabitId = habit.id; renderHabits(); renderCalendar(); }); item.querySelector('.habit-edit').addEventListener('click', event => { event.stopPropagation(); openHabitDialog(habit.id); }); item.querySelector('.habit-delete').addEventListener('click', event => { event.stopPropagation(); if (window.confirm(`确定删除“${habit.name}”及其打卡记录吗？`)) { habits = habits.filter(entry => entry.id !== habit.id); saveHabits(); if (selectedHabitId === habit.id) selectedHabitId = habits[0]?.id || null; renderHabits(); renderCalendar(); } });
    list.append(item);
  });
  renderCalendar();
}
function checkIn(id) { const habit = habits.find(entry => entry.id === id); if (!habit) return; if (habit.mode === 'single' && todayCount(habit)) return; habit.logs.push({ id: uid(), at: new Date().toISOString() }); saveHabits(); selectedHabitId = id; renderHabits(); }
function renderCalendar() {
  const habit = habits.find(entry => entry.id === selectedHabitId); const empty = document.querySelector('#calendarEmpty'); const content = document.querySelector('#calendarContent');
  if (!habit) { empty.hidden = false; content.hidden = true; document.querySelector('#calendarTitle').textContent = '选择一个打卡项'; return; }
  empty.hidden = true; content.hidden = false; document.querySelector('#calendarTitle').textContent = habit.name; const counts = countByDay(habit); const end = new Date(); end.setHours(0, 0, 0, 0); const start = new Date(end); start.setDate(end.getDate() - 364); const max = Math.max(1, ...Object.values(counts)); const padding = start.getDay(); const totalCells = Math.ceil((padding + 365) / 7) * 7; const heatmap = document.querySelector('#heatmap'); heatmap.innerHTML = '';
  for (let index = 0; index < totalCells; index += 1) { const cell = document.createElement('span'); cell.className = 'heat-cell'; if (index < padding) { cell.classList.add('blank'); heatmap.append(cell); continue; } const date = new Date(start); date.setDate(start.getDate() + index - padding); const key = localDateKey(date); const count = counts[key] || 0; const level = count ? Math.min(4, Math.max(1, Math.ceil(count / max * 4))) : 0; cell.classList.add(`level-${level}`); cell.title = `${formatDay(key)}：${count ? `${count} 次打卡` : '未打卡'}`; cell.setAttribute('aria-label', cell.title); heatmap.append(cell); }
  const total = habit.logs.length; const recentStart = new Date(end); recentStart.setDate(end.getDate() - 29); const recent = habit.logs.filter(log => new Date(log.at || log) >= recentStart).length; const progress = goalProgress(habit); document.querySelector('#calendarTotal').textContent = total; document.querySelector('#calendarRecent').textContent = recent; document.querySelector('#calendarGoal').textContent = `${progress}/${habit.goalTarget}${habit.goalType === 'days' ? '天' : '次'}`; document.querySelector('#calendarHint').textContent = `${habit.goalType === 'days' ? '按有打卡记录的日期计入目标' : '每次打卡都会计入目标'} · 目标完成后仍可继续打卡 · 最后修改于 ${formatTime(habit.updatedAt)}`;
}

todoForm.addEventListener('submit', event => { event.preventDefault(); const title = titleInput.value.trim(); if (!title) return; todos.unshift({ id: uid(), title, due: dueInput.value, done: false, createdAt: Date.now() }); saveTodos(); todoForm.reset(); renderTodos(); titleInput.focus(); });
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => { filter = tab.dataset.filter; document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button === tab)); renderTodos(); }));
document.querySelector('#clearCompleted').addEventListener('click', () => { if (todos.some(todo => todo.done)) { todos = todos.filter(todo => !todo.done); saveTodos(); renderTodos(); } });
document.querySelector('#cancelEdit').addEventListener('click', () => editDialog.close());
editForm.addEventListener('submit', event => { event.preventDefault(); const todo = todos.find(entry => entry.id === editDialog.dataset.id); const title = document.querySelector('#editTitle').value.trim(); if (!todo || !title) return; todo.title = title; todo.due = document.querySelector('#editDue').value; saveTodos(); editDialog.close(); renderTodos(); });
document.querySelector('#addHabitButton').addEventListener('click', () => openHabitDialog());
document.querySelector('#cancelHabit').addEventListener('click', () => document.querySelector('#habitDialog').close());
document.querySelector('#habitForm').addEventListener('submit', event => { event.preventDefault(); const name = document.querySelector('#habitName').value.trim(); const target = Math.max(1, Math.floor(Number(document.querySelector('#habitGoalTarget').value))); if (!name || !Number.isFinite(target)) return; const now = Date.now(); const data = { name, mode: document.querySelector('#habitMode').value, goalType: document.querySelector('#habitGoalType').value, goalTarget: target }; if (editingHabitId) { const habit = habits.find(entry => entry.id === editingHabitId); if (habit) Object.assign(habit, data, { updatedAt: now }); } else { const habit = { id: uid(), ...data, logs: [], createdAt: now, updatedAt: now }; habits.unshift(habit); selectedHabitId = habit.id; } saveHabits(); document.querySelector('#habitDialog').close(); renderHabits(); });
document.querySelectorAll('.nav-btn').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.nav-btn').forEach(item => item.classList.toggle('active', item === button)); document.querySelectorAll('.app-view').forEach(view => { view.hidden = view.id !== button.dataset.view; }); if (button.dataset.view === 'habitView') renderHabits(); }));

renderTodos(); renderHabits();
