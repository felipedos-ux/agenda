// ===== Supabase Adapter (apenas camada de dados; não muda UI) =====
const db = {
  client: null,
  init() {
    const { createClient } = window.supabase || {};
    if (!createClient) {
      console.error("Supabase SDK não carregado.");
      return;
    }
    this.client = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  },

// ---------- TASKS ----------
async loadTasks() {
  const { data, error } = await this.client
    .from('tasks')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (error) throw error;
 return (data || []).map(row => {
  // normaliza status para os três usados pela UI
  const statusMap = {
    'afazer': 'pendente',
    'todo': 'pendente',
    'doing': 'andamento',
    'in_progress': 'andamento',
    'em_andamento': 'andamento',
    'done': 'concluida',
    'concluída': 'concluida',
    'concluido': 'concluida'
  };
  const normStatus = statusMap[(row.status || '').toLowerCase()] || row.status || 'pendente';

  return {
    id: row.id,
    title: row.title || '',
    name: row.title || '',
    description: row.description || '',
    date: row.date || '',
    time: row.time || '',
    priority: row.priority || 'normal',
    status: normStatus,
    alarm: !!row.alarm,            // se existir no schema
    createdAt: row.created_at || new Date().toISOString()
  };
});
},
async upsertTask(task) {
  // mapeia status da UI (pendente/andamento/concluida) para o schema do banco (afazer/andamento/concluida)
  const statusMapOut = {
    pendente: 'afazer',
    andamento: 'andamento',
    concluida: 'concluida'
  };
  const normalizedStatus =
    statusMapOut[(task.status || '').toLowerCase()] || 'afazer';

  const payload = {
    id: String(task.id),
    title: (task.title ?? task.name ?? '').toString(),
    description: task.description ?? null,
    date: task.date ?? null,
    time: (task.time && task.time.trim() !== '') ? task.time : null,
    priority: task.priority ?? 'normal',
    status: normalizedStatus,
    // ⚠️ IMPORTANTE: não existe coluna "alarm" na tabela tasks, então NÃO enviamos
    alarm: task.alarm ?? false,
    updated_at: new Date().toISOString()
  };

  if (!task.createdAt) {
    payload.created_at = new Date().toISOString();
  }

  const { error } = await this.client.from('tasks').upsert(payload);
  if (error) {
    console.error('Erro ao salvar tarefa no Supabase:', error);
    throw error;
  }
},
async deleteTask(id) {
  const { error } = await this.client.from('tasks').delete().eq('id', String(id));
  if (error) throw error;
},


  // ---------- EXAMS ----------
  async loadExams() {
    const { data, error } = await this.client
      .from('exams').select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      type: row.title || '',
      date: row.date || '',
      time: row.time || '',
      location: row.location || '',
      notes: row.description || '',
      fileName: null
    }));
  },
  async upsertExam(exam) {
    const payload = {
      id: String(exam.id),
      title: exam.type ?? '',
      description: exam.notes ?? null,
      date: exam.date ?? null,
      time: exam.time ?? null,
      location: exam.location ?? null,
      updated_at: new Date().toISOString()
    };
    const { error } = await this.client.from('exams').upsert(payload);
    if (error) throw error;
  },
  async deleteExam(id) {
    const { error } = await this.client.from('exams').delete().eq('id', String(id));
    if (error) throw error;
  },

  // ---------- SHOPPING ----------
  async loadShopping(listType) {
    const { data, error } = await this.client
      .from('shopping_items').select('*')
      .eq('list_type', listType)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      qty: Number(row.quantity ?? 1),
      price: Number(row.unit_price ?? 0),
      purchased: !!row.purchased
    }));
  },
  async upsertShoppingItem(listType, item) {
    const payload = {
      id: String(item.id),
      list_type: listType,
      name: item.name,
      quantity: item.qty ?? 1,
      unit_price: item.price ?? null,
      purchased: !!item.purchased,
      updated_at: new Date().toISOString()
    };
    const { error } = await this.client.from('shopping_items').upsert(payload);
    if (error) throw error;
  },
  async deleteShoppingItem(id) {
    const { error } = await this.client.from('shopping_items').delete().eq('id', String(id));
    if (error) throw error;
  },

  // ---------- PROJECTS & PROJECT_TASKS ----------
    async loadProjectsWithTasks() {
    const { data: projects, error: e1 } = await this.client
      .from('projects').select('*').order('created_at', { ascending: true });
    if (e1) throw e1;

    const { data: tasks, error: e2 } = await this.client
      .from('project_tasks').select('*').order('created_at', { ascending: true });
    if (e2) throw e2;

    const taskByProject = {};
    (tasks || []).forEach(t => {
      (taskByProject[t.project_id] ||= []).push({
        id: t.id,
        name: t.title || '',
        description: t.description || '',
        state: t.state || 'fazer',
        timeSpent: Number(t.time_spent ?? 0),
        isRunning: !!t.is_running,
        startTime: t.start_time ? Number(t.start_time) : null,
        createdAt: t.created_at || null  // Adicionado: Para identificar novos vs existentes
      });
    });

    return (projects || []).map(p => ({
      id: p.id,
      name: p.name || '',
      description: p.description || '',
      createdAt: p.created_at || null,  // Adicionado: Para identificar novos vs existentes
      tasks: taskByProject[p.id] || []
    }));
  },

    async upsertProject(project) {
      const payload = {
        id: String(project.id),
        name: project.name,
        description: project.description ?? null,
        updated_at: new Date().toISOString()
      };
      // Removido: Não enviamos created_at - banco cuida
      const { error } = await this.client.from('projects').upsert(payload);
      if (error) throw error;
    },

    async upsertProjectTask(projectId, task) {
    const payload = {
      id: String(task.id),
      project_id: String(projectId),
      title: task.name,
      description: task.description ?? null,
      state: task.state ?? 'fazer',
      time_spent: Number(Math.floor(task.timeSpent ?? 0)),
      is_running: !!task.isRunning,
      start_time: task.startTime ? Number(Math.floor(task.startTime)) : null,
      updated_at: new Date().toISOString()
    };
    const { error } = await this.client.from('project_tasks').upsert(payload);
    if (error) throw error;
  },
  async updateProjectTaskTimer(projectId, task) {
    return this.upsertProjectTask(projectId, task);
  },
  async deleteProjectTask(id) {
    const { error } = await this.client.from('project_tasks').delete().eq('id', String(id));
    if (error) throw error;
  },

  // ---------- LOAD ALL ----------
  async loadAllInto(state) {
    const [tasks, exams, sup, far, projects] = await Promise.all([
      this.loadTasks(),
      this.loadExams(),
      this.loadShopping('supermercado'),
      this.loadShopping('farmacia'),
      this.loadProjectsWithTasks()
    ]);
    state.tasks = tasks;
    state.exams = exams;
    state.shoppingLists.supermercado = sup;
    state.shoppingLists.farmacia = far;
    state.projects = projects;
  }
};

const app = {
  // State management (in-memory)
  state: {
    notified: {
      tasks: {},   // ex.: notified.tasks[taskId] = true
      exams: {}    // ex.: notified.exams[examId] = true
    },
    tasks: [],
    shoppingLists: {
      supermercado: [],
      farmacia: []
    },
    exams: [],
    projects: [],
    currentTab: 'tarefas',
    currentShoppingList: 'supermercado',
    calendarView: 'month',
    currentDate: new Date(),
    editingTask: null,
    editingExam: null,
    editingProject: null,
    editingProjectTask: null,
    currentProjectId: null,
    settings: {
      notificationSound: 'bell',
      defaultCalendarView: 'month',
      enableNotifications: true,
      notificationTime: 15
    },
    timers: {},
    pomodoro: {
      focusTime: 25, // minutes
      breakTime: 5, // minutes
      currentTime: 25 * 60, // seconds
      isRunning: false,
      isPaused: false,
      mode: 'focus', // 'focus' or 'break'
      intervalId: null,
      audio: {
        enabled: true,
        volume: 0.7,
        currentSource: 'bluenoise',
        isPlaying: false
      }
    }
  },

  // Initialize app
    async init() {
      db.init();
      try { await db.loadAllInto(this.state); } catch (e) { console.warn("Load Supabase falhou:", e); }

    this.setDefaultDates();
    this.setupEventListeners();
    this.setupHamburgerMenu();
    this.renderTasksDashboard();
    this.renderCalendar();
    this.renderTasks();
    this.checkNotifications();
    setInterval(() => this.checkNotifications(), 60000); // Check every minute
    this.updateAllTimers();
    this.initPomodoro();
  },

  // Set default dates to today (using local time to avoid timezone issues)
  setDefaultDates() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const quickTaskDate = document.getElementById('quickTaskDate');
    const taskDate = document.getElementById('taskDate');
    const examDate = document.getElementById('examDate');
    
    if (quickTaskDate) quickTaskDate.value = todayStr;
    if (taskDate) taskDate.value = todayStr;
    if (examDate) examDate.value = todayStr;
  },

  // Helper function to convert YYYY-MM-DD string to local Date without timezone issues
  parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  },

  // Helper function to format date from YYYY-MM-DD string
  formatDateStr(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  },

  // Setup hamburger menu
  setupHamburgerMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sideMenu = document.getElementById('sideMenu');
    const sideMenuOverlay = document.getElementById('sideMenuOverlay');
    const closeSideMenu = document.getElementById('closeSideMenu');

    // Open side menu
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => {
        sideMenu.classList.add('active');
        sideMenuOverlay.classList.add('active');
      });
    }

    // Close side menu
    const closeSideMenuFunc = () => {
      sideMenu.classList.remove('active');
      sideMenuOverlay.classList.remove('active');
    };

    if (closeSideMenu) {
      closeSideMenu.addEventListener('click', closeSideMenuFunc);
    }

    if (sideMenuOverlay) {
      sideMenuOverlay.addEventListener('click', closeSideMenuFunc);
    }

    // Side menu items navigation
    document.querySelectorAll('.side-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
        closeSideMenuFunc();
        
        // Update active state in side menu
        document.querySelectorAll('.side-menu-item').forEach(btn => {
          btn.classList.remove('active');
        });
        e.target.classList.add('active');
      });
    });
  },

  // Setup event listeners
  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  },

  // Tab switching
  switchTab(tabName) {
    this.state.currentTab = tabName;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Render content for the current tab
    if (tabName === 'tarefas') {
      this.renderTasksDashboard();
    } else if (tabName === 'agenda') {
      this.renderCalendar();
      this.renderTasks();
    } else if (tabName === 'compras') {
      this.renderShoppingList();
    } else if (tabName === 'exames') {
      this.renderExams();
    } else if (tabName === 'projetos') {
      this.renderProjects();
    } else if (tabName === 'foco') {
      this.updatePomodoroDisplay();
    }
  },

  // Theme toggle
  toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-color-scheme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-color-scheme', newTheme);
    document.getElementById('themeIcon').textContent = newTheme === 'dark' ? '☀️' : '🌙';
  },

  // Calendar functions
  changeCalendarView(view) {
    this.state.calendarView = view;
    this.renderCalendar();
  },

  renderCalendar() {
    const container = document.getElementById('calendarDisplay');
    if (!container) return;

    if (this.state.calendarView === 'month') {
      this.renderMonthCalendar(container);
    } else {
      this.renderWeekCalendar(container);
    }
  },

  renderMonthCalendar(container) {
    const date = this.state.currentDate;
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    let html = `
      <div class="calendar-header">
        <button class="btn btn--sm" onclick="app.previousMonth()">←</button>
        <h3>${monthNames[month]} ${year}</h3>
        <button class="btn btn--sm" onclick="app.nextMonth()">→</button>
      </div>
      <div class="calendar-grid">
    `;

    // Day headers
    dayNames.forEach(day => {
      html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -startingDayOfWeek + i + 1).getDate();
      html += `<div class="calendar-day other-month">${prevMonthDay}</div>`;
    }

    // Days of the month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
      const hasPendingTasks = this.hasPendingTasksOnDate(currentDate);
      const hasInProgressTasks = this.hasInProgressTasksOnDate(currentDate);
      const hasExams = this.hasExamsOnDate(currentDate);
      
      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (hasPendingTasks) classes += ' has-pending-tasks';
      if (hasInProgressTasks) classes += ' has-in-progress-tasks';
      if (hasExams) classes += ' has-exams';
      if ((hasPendingTasks || hasInProgressTasks) && hasExams) classes += ' multiple-indicators';

      html += `<div class="${classes}">${day}</div>`;
    }

    // Fill remaining cells
    const totalCells = startingDayOfWeek + daysInMonth;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        html += `<div class="calendar-day other-month">${i}</div>`;
      }
    }

    html += '</div>';
    container.innerHTML = html;
  },

  renderWeekCalendar(container) {
    const date = this.state.currentDate;
    const dayOfWeek = date.getDay();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek);

    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    let html = `
      <div class="calendar-header">
        <button class="btn btn--sm" onclick="app.previousWeek()">←</button>
        <h3>Semana de ${startOfWeek.toLocaleDateString('pt-BR')}</h3>
        <button class="btn btn--sm" onclick="app.nextWeek()">→</button>
      </div>
      <div class="calendar-grid" style="grid-template-columns: repeat(7, 1fr);">
    `;

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const isToday = this.isToday(currentDate);
      const hasPendingTasks = this.hasPendingTasksOnDate(currentDate);
      const hasInProgressTasks = this.hasInProgressTasksOnDate(currentDate);
      const hasExams = this.hasExamsOnDate(currentDate);
      
      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (hasPendingTasks) classes += ' has-pending-tasks';
      if (hasInProgressTasks) classes += ' has-in-progress-tasks';
      if (hasExams) classes += ' has-exams';
      if ((hasPendingTasks || hasInProgressTasks) && hasExams) classes += ' multiple-indicators';

      html += `
        <div style="text-align: center; padding: var(--space-12);">
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">
            ${dayNames[i]}
          </div>
          <div class="${classes}" style="width: 48px; height: 48px; margin: 0 auto;">
            ${currentDate.getDate()}
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  previousMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
    this.renderCalendar();
  },

  nextMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
    this.renderCalendar();
  },

  previousWeek() {
    this.state.currentDate.setDate(this.state.currentDate.getDate() - 7);
    this.renderCalendar();
  },

  nextWeek() {
    this.state.currentDate.setDate(this.state.currentDate.getDate() + 7);
    this.renderCalendar();
  },

  isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  },

  hasTasksOnDate(date) {
    return this.state.tasks.some(task => {
      const taskDate = this.parseLocalDate(task.date);
      return taskDate.getDate() === date.getDate() &&
             taskDate.getMonth() === date.getMonth() &&
             taskDate.getFullYear() === date.getFullYear();
    });
  },

  hasPendingTasksOnDate(date) {
    return this.state.tasks.some(task => {
      if (task.status !== 'pendente') return false;
      const taskDate = this.parseLocalDate(task.date);
      return taskDate.getDate() === date.getDate() &&
             taskDate.getMonth() === date.getMonth() &&
             taskDate.getFullYear() === date.getFullYear();
    });
  },

  hasInProgressTasksOnDate(date) {
    return this.state.tasks.some(task => {
      if (task.status !== 'andamento') return false;
      const taskDate = this.parseLocalDate(task.date);
      return taskDate.getDate() === date.getDate() &&
             taskDate.getMonth() === date.getMonth() &&
             taskDate.getFullYear() === date.getFullYear();
    });
  },

  hasExamsOnDate(date) {
    return this.state.exams.some(exam => {
      const examDate = this.parseLocalDate(exam.date);
      return examDate.getDate() === date.getDate() &&
             examDate.getMonth() === date.getMonth() &&
             examDate.getFullYear() === date.getFullYear();
    });
  },

  // Task functions
  openTaskModal(taskId = null) {
    const modal = document.getElementById('taskModal');
    const title = document.getElementById('taskModalTitle');
    
    if (taskId != null) {
      this.state.editingTask = this.state.tasks.find(
        t => String(t.id) === String(taskId)
      );

      if (!this.state.editingTask) {
        console.warn('Tarefa não encontrada para edição. id:', taskId);
        return;
      }

      title.textContent = 'Editar Tarefa';
      this.populateTaskForm(this.state.editingTask);
    } else {
      this.state.editingTask = null;
      title.textContent = 'Nova Tarefa';
      this.clearTaskForm();
      // Set today's date as default for new tasks
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      document.getElementById('taskDate').value = todayStr;
    }
    
    modal.classList.add('active');
  },


  closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
    this.state.editingTask = null;
    this.clearTaskForm();
  },

  populateTaskForm(task) {
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description;
    document.getElementById('taskDate').value = task.date;
    document.getElementById('taskTime').value = task.time || '';
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskAlarm').checked = task.alarm;
  },

  clearTaskForm() {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('taskDate').value = todayStr;
    document.getElementById('taskTime').value = '';
    document.getElementById('taskPriority').value = 'normal';
    document.getElementById('taskStatus').value = 'pendente';
    document.getElementById('taskAlarm').checked = false;
  },

  saveTask() {
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const date = document.getElementById('taskDate').value;
    const time = document.getElementById('taskTime').value;
    const priority = document.getElementById('taskPriority').value;
    const status = document.getElementById('taskStatus').value;
    const alarm = document.getElementById('taskAlarm').checked;

    if (!title || !date) {
      alert('Por favor, preencha o título e a data.');
      return;
    }

    const task = {
      id: this.state.editingTask ? this.state.editingTask.id : String(Date.now()),
      title,
      description,
      date,
      time,
      priority,
      status,
      alarm,
      createdAt: this.state.editingTask ? this.state.editingTask.createdAt : new Date().toISOString()
    };

    if (this.state.editingTask) {
      const index = this.state.tasks.findIndex(t => t.id === this.state.editingTask.id);
      this.state.tasks[index] = task;
    } else {
      this.state.tasks.push(task);
    }

    this.closeTaskModal();
    this.renderTasks();
    this.renderTasksDashboard();
    this.renderCalendar();
    db.upsertTask(task).catch(console.error); // SUPABASE
  },

  deleteTask(taskId) {
    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
      this.state.tasks = this.state.tasks.filter(t => String(t.id) !== String(taskId));
      this.renderTasks();
      this.renderTasksDashboard();
      this.renderCalendar();
    }
    db.deleteTask(taskId).catch(console.error); // SUPABASE

  },

  // Quick task functions for Tasks tab
  addQuickTask() {
    const title = document.getElementById('quickTaskTitle').value.trim();
    const description = document.getElementById('quickTaskDescription').value.trim();
    const date = document.getElementById('quickTaskDate').value;
    const time = document.getElementById('quickTaskTime').value;
    const priority = document.getElementById('quickTaskPriority').value;

    if (!title) {
      alert('Por favor, digite o título da tarefa.');
      return;
    }

    const task = {
      id: String(Date.now()),
      title,
      description,
      date,
      time,
      priority,
      status: 'pendente',
      alarm: false,
      createdAt: new Date().toISOString()
    };

    this.state.tasks.push(task);
    
    // Clear form and reset date to today
    document.getElementById('quickTaskTitle').value = '';
    document.getElementById('quickTaskDescription').value = '';
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('quickTaskDate').value = todayStr;
    document.getElementById('quickTaskTime').value = '';
    document.getElementById('quickTaskPriority').value = 'normal';
    
    this.renderTasksDashboard();
    this.renderTasks();
    this.renderCalendar();
    db.upsertTask(task).catch(console.error); // SUPABASE
  },

  changeTaskStatus(taskId, newStatus) {
    const task = this.state.tasks.find(t => String(t.id) === String(taskId));
    if (task) {
      task.status = newStatus;
      this.renderTasksDashboard();
      this.renderTasks();
      db.upsertTask(task).catch(console.error);
    }
  },

  filterTasksView() {
    this.renderTasksDashboard();
  },

  renderTasksDashboard() {
    // Render upcoming exams
    this.renderUpcomingExams();
    
    // Get filter values
    const statusFilter = document.getElementById('taskStatusFilter')?.value || 'all';
    const priorityFilter = document.getElementById('taskPriorityFilter')?.value || 'all';
    
    // Filter tasks
    let tasks = this.state.tasks;
    if (statusFilter !== 'all') {
      tasks = tasks.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      tasks = tasks.filter(t => t.priority === priorityFilter);
    }
    
    // Sort by date and priority
    tasks.sort((a, b) => {
      const dateA = this.parseLocalDate(a.date);
      const dateB = this.parseLocalDate(b.date);
      if (a.time && b.time) {
        const [hourA, minA] = a.time.split(':').map(Number);
        const [hourB, minB] = b.time.split(':').map(Number);
        dateA.setHours(hourA, minA);
        dateB.setHours(hourB, minB);
      }
      return dateA - dateB;
    });
    
    // Separate by status
    const pendenteTasks = tasks.filter(t => t.status === 'pendente');
    const andamentoTasks = tasks.filter(t => t.status === 'andamento');
    const concluidaTasks = tasks.filter(t => t.status === 'concluida');
    
    // Render each column
    this.renderTasksColumn('pendenteTasksList', pendenteTasks, 'pendente');
    this.renderTasksColumn('andamentoTasksList', andamentoTasks, 'andamento');
    this.renderTasksColumn('concluidaTasksList', concluidaTasks, 'concluida');
  },

  renderTasksColumn(elementId, tasks, status) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    if (tasks.length === 0) {
      container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: var(--space-16); font-size: var(--font-size-sm);">Nenhuma tarefa</p>';
      return;
    }
    
    const priorityIcons = {
      urgente: '🔴',
      normal: '🟡',
      baixa: '🟢'
    };
    
    let html = '';
    tasks.forEach(task => {
      const dateObj = this.parseLocalDate(task.date);
      const formattedDate = this.formatDateStr(task.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = dateObj < today && status !== 'concluida';
      
      html += `
        <div class="task-card priority-${task.priority}">
          <div class="task-card-title">${priorityIcons[task.priority]} ${task.title}</div>
          ${task.description ? `<div class="task-card-description">${task.description}</div>` : ''}
          <div class="task-card-meta">
            <span>📅 ${formattedDate}</span>
            ${task.time ? `<span>🕐 ${task.time}</span>` : ''}
            ${isOverdue ? '<span style="color: var(--color-error); font-weight: var(--font-weight-semibold);">⚠️ Atrasada</span>' : ''}
            ${task.alarm ? '<span>🔔</span>' : ''}
          </div>
          <div class="task-card-actions">
            <div style="display: flex; gap: var(--space-4);">
               ${status === 'pendente' ? `<button class="btn btn--sm btn--primary" onclick="app.changeTaskStatus('${task.id}', 'andamento')" title="Iniciar">▶️</button>` : ''}
               ${status === 'andamento' ? `<button class="btn btn--sm btn--primary" onclick="app.changeTaskStatus('${task.id}', 'concluida')" title="Concluir">✓</button>` : ''}
               ${status === 'andamento' ? `<button class="btn btn--sm btn--secondary" onclick="app.changeTaskStatus('${task.id}', 'pendente')" title="Voltar">⏸</button>` : ''}
               ${status === 'concluida' ? `<button class="btn btn--sm btn--secondary" onclick="app.changeTaskStatus('${task.id}', 'pendente')" title="Reabrir">↺</button>` : ''}
            </div>
            <div style="display: flex; gap: var(--space-4);">
               <button class="btn btn--sm btn--secondary" onclick="app.openTaskModal('${task.id}')">✏️</button>
               <button class="btn btn--sm btn--secondary" onclick="app.deleteTask('${task.id}')">🗑️</button>

            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  },

  renderUpcomingExams() {
    const container = document.getElementById('upcomingExamsSection');
    if (!container) return;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const futureExams = this.state.exams.filter(exam => {
      const examDate = this.parseLocalDate(exam.date);
      const daysDiff = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= 7; // Next 7 days
    });
    
    if (futureExams.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    futureExams.sort((a, b) => this.parseLocalDate(a.date) - this.parseLocalDate(b.date));
    
    let html = '<div style="margin-bottom: var(--space-16);"><h3 style="font-size: var(--font-size-lg); margin-bottom: var(--space-12);">🏥 Exames Próximos</h3>';
    
    futureExams.forEach(exam => {
      const examDate = this.parseLocalDate(exam.date);
      const formattedDate = this.formatDateStr(exam.date);
      const daysDiff = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
      let daysText = '';
      if (daysDiff === 0) daysText = 'Hoje';
      else if (daysDiff === 1) daysText = 'Amanhã';
      else daysText = `Em ${daysDiff} dias`;
      
      html += `
        <div class="upcoming-exam-card">
          <h4>🏥 ${exam.type}</h4>
          <div class="upcoming-exam-info">
            <span><strong>${daysText}</strong> - ${formattedDate}</span>
            ${exam.time ? `<span>🕐 ${exam.time}</span>` : ''}
            ${exam.location ? `<span>📍 ${exam.location}</span>` : ''}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  },

  filterTasks() {
    this.renderTasks();
  },

  renderTasks() {
    const container = document.getElementById('tasksList');
    if (!container) return;

    const filter = document.getElementById('statusFilter')?.value || 'all';
    let tasks = this.state.tasks;

    if (filter !== 'all') {
      tasks = tasks.filter(t => t.status === filter);
    }

    // Sort by date
    tasks.sort((a, b) => {
      const dateA = this.parseLocalDate(a.date);
      const dateB = this.parseLocalDate(b.date);
      if (a.time && b.time) {
        const [hourA, minA] = a.time.split(':').map(Number);
        const [hourB, minB] = b.time.split(':').map(Number);
        dateA.setHours(hourA, minA);
        dateB.setHours(hourB, minB);
      }
      return dateA - dateB;
    });

    if (tasks.length === 0) {
      container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: var(--space-24);">Nenhuma tarefa encontrada.</p>';
      return;
    }

    const priorityIcons = {
      urgente: '🔴',
      normal: '🟡',
      baixa: '🟢'
    };

    let html = '';
    tasks.forEach(task => {
      const formattedDate = this.formatDateStr(task.date);
      
      html += `
        <div class="task-item priority-${task.priority}">
          <div class="task-info">
            <div class="task-title">${priorityIcons[task.priority]} ${task.title}</div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
            <div class="task-meta">
              <span>📅 ${formattedDate}</span>
              ${task.time ? `<span>🕐 ${task.time}</span>` : ''}
              <span class="status-badge ${task.status}">${this.getStatusLabel(task.status)}</span>
              ${task.alarm ? '<span>🔔 Alarme ativo</span>' : ''}
            </div>
          </div>
          <div class="task-actions">
            <button class="btn btn--sm btn--secondary" onclick="app.openTaskModal('${task.id}')">✏️</button>
            <button class="btn btn--sm btn--secondary" onclick="app.deleteTask('${task.id}')">🗑️</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  getStatusLabel(status) {
    const labels = {
      pendente: 'Pendente',
      andamento: 'Em Andamento',
      concluida: 'Concluída'
    };
    return labels[status] || status;
  },

  // Shopping list functions
  switchShoppingList(type) {
    this.state.currentShoppingList = type;
    document.querySelectorAll('.shop-type-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[onclick="app.switchShoppingList('${type}')"]`).classList.add('active');
    
    document.querySelectorAll('.shopping-list').forEach(list => {
      list.classList.remove('active');
    });
    document.getElementById(`${type}-list`).classList.add('active');
  },

  addShoppingItem(type) {
    const itemInput = document.getElementById(`${type === 'supermercado' ? 'super' : 'farm'}-item`);
    const qtyInput = document.getElementById(`${type === 'supermercado' ? 'super' : 'farm'}-qty`);
    const priceInput = document.getElementById(`${type === 'supermercado' ? 'super' : 'farm'}-price`);

    const name = itemInput.value.trim();
    const qty = parseInt(qtyInput.value) || 1;
    const price = parseFloat(priceInput.value) || 0;

    if (!name) {
      alert('Por favor, digite o nome do item.');
      return;
    }

    const item = {
      id: String(Date.now()),  // Correção: Novo id como string
      name,
      qty,
      price,
      purchased: false
    };

    this.state.shoppingLists[type].push(item);
    
    itemInput.value = '';
    qtyInput.value = '1';
    priceInput.value = '';
    
    this.renderShoppingList();
    db.upsertShoppingItem(type, item).catch(error => {
      console.error('Erro ao salvar item de compra:', error);
      alert('Erro ao salvar no banco de dados. Verifique o console para detalhes.');  // Adicionado: Alerta para usuário
    }); // SUPABASE
  },

  editShoppingItem(type, itemId) {
    const item = this.state.shoppingLists[type].find(i => i.id === itemId);  // Comparação safe (id como string ou number, mas após correção, string)
    if (!item) return;

    const newName = prompt('Nome do item:', item.name);
    if (newName === null) return;
    
    const newQty = prompt('Quantidade:', item.qty);
    if (newQty === null) return;
    
    const newPrice = prompt('Preço (R$):', item.price);
    if (newPrice === null) return;

    if (newName.trim()) {
      item.name = newName.trim();
    }
    if (newQty && !isNaN(parseInt(newQty))) {
      item.qty = parseInt(newQty);
    }
    if (newPrice && !isNaN(parseFloat(newPrice))) {
      item.price = parseFloat(newPrice);
    }

    this.renderShoppingList();
    db.upsertShoppingItem(type, item).catch(error => {
      console.error('Erro ao editar item de compra:', error);
      alert('Erro ao editar no banco de dados. Verifique o console para detalhes.');  // Adicionado: Alerta para usuário
    }); // SUPABASE
  },

  togglePurchased(type, itemId) {
    const item = this.state.shoppingLists[type].find(i => i.id === itemId);
    if (item) {
      item.purchased = !item.purchased;
      this.renderShoppingList();
    }
    db.upsertShoppingItem(type, item).catch(error => {
      console.error('Erro ao atualizar status de compra:', error);
      alert('Erro ao atualizar no banco de dados. Verifique o console para detalhes.');  // Adicionado: Alerta para usuário
    }); // SUPABASE
  },

  deleteShoppingItem(type, itemId) {
    this.state.shoppingLists[type] = this.state.shoppingLists[type].filter(i => i.id !== itemId);
    this.renderShoppingList();
    db.deleteShoppingItem(itemId).catch(console.error); // SUPABASE
  },

    renderShoppingList() {
    ['supermercado', 'farmacia'].forEach(type => {
      const container = document.getElementById(`${type}-items`);
      const totalElement = document.getElementById(`${type}-total`);
      if (!container) return;

      const items = this.state.shoppingLists[type];
      
      if (items.length === 0) {
        container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: var(--space-16);">Nenhum item adicionado.</p>';
        totalElement.textContent = '0.00';
        return;
      }

      let html = '';
      let total = 0;

      items.forEach(item => {
        const itemTotal = item.qty * item.price;
        if (!item.purchased) {
          total += itemTotal;
        }

        html += `
          <div class="shopping-item ${item.purchased ? 'purchased' : ''}">
            <div class="shopping-item-info">
              <input type="checkbox" ${item.purchased ? 'checked' : ''} 
                     onchange="app.togglePurchased('${type}', '${item.id}')">  <!-- Correção: Aspas ao redor do id -->
              <span><strong>${item.name}</strong> - Qtd: ${item.qty} - R$ ${item.price.toFixed(2)}</span>
              <span style="color: var(--color-text-secondary);">Total: R$ ${itemTotal.toFixed(2)}</span>
            </div>
            <div class="shopping-item-actions">
              <button class="btn btn--sm btn--secondary" onclick="app.editShoppingItem('${type}', '${item.id}')" title="Editar">✏️</button>  <!-- Correção: Aspas ao redor do id -->
              <button class="btn btn--sm btn--secondary" onclick="app.deleteShoppingItem('${type}', '${item.id}')" title="Excluir">🗑️</button>  <!-- Correção: Aspas ao redor do id -->
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      totalElement.textContent = total.toFixed(2);
    });
  },

  // Exam functions
  openExamModal(examId = null) {
    const modal = document.getElementById('examModal');
    const title = document.getElementById('examModalTitle');
    
    if (examId) {
      this.state.editingExam = this.state.exams.find(e => e.id === examId);
      title.textContent = 'Editar Exame';
      this.populateExamForm(this.state.editingExam);
    } else {
      this.state.editingExam = null;
      title.textContent = 'Novo Exame';
      this.clearExamForm();
      // Set today's date as default for new exams
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      document.getElementById('examDate').value = todayStr;
    }
    
    modal.classList.add('active');
  },

  closeExamModal() {
    document.getElementById('examModal').classList.remove('active');
    this.state.editingExam = null;
    this.clearExamForm();
  },

  populateExamForm(exam) {
    document.getElementById('examType').value = exam.type;
    document.getElementById('examDate').value = exam.date;
    document.getElementById('examTime').value = exam.time || '';
    document.getElementById('examLocation').value = exam.location || '';
    document.getElementById('examNotes').value = exam.notes || '';
  },

  clearExamForm() {
    document.getElementById('examType').value = '';
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('examDate').value = todayStr;
    document.getElementById('examTime').value = '';
    document.getElementById('examLocation').value = '';
    document.getElementById('examNotes').value = '';
    document.getElementById('examFile').value = '';
  },

  saveExam() {
    const type = document.getElementById('examType').value;
    const date = document.getElementById('examDate').value;
    const time = document.getElementById('examTime').value;
    const location = document.getElementById('examLocation').value;
    const notes = document.getElementById('examNotes').value;
    const fileInput = document.getElementById('examFile');

    if (!type || !date) {
      alert('Por favor, preencha o tipo e a data do exame.');
      return;
    }

    const exam = {
      id: this.state.editingExam ? this.state.editingExam.id : String(Date.now()),  // Correção: Novo id como string
      type,
      date,
      time,
      location,
      notes,
      fileName: fileInput.files[0]?.name || this.state.editingExam?.fileName || null
    };

    if (this.state.editingExam) {
      const index = this.state.exams.findIndex(e => e.id === this.state.editingExam.id);  // Comparação safe (ambos string)
      this.state.exams[index] = exam;
    } else {
      this.state.exams.push(exam);
    }

    this.closeExamModal();
    this.renderExams();
    this.renderTasksDashboard();
    db.upsertExam(exam).catch(error => {
      console.error('Erro ao salvar exame:', error);
      alert('Erro ao salvar no banco de dados. Verifique o console para detalhes.');  // Adicionado: Alerta para usuário
    }); // SUPABASE
  },

  deleteExam(examId) {
    if (confirm('Tem certeza que deseja excluir este exame?')) {
      this.state.exams = this.state.exams.filter(e => e.id !== examId);
      this.renderExams();
      this.renderTasksDashboard();
    }
    db.deleteExam(examId).catch(console.error); // SUPABASE
  },

   renderExams() {
    const container = document.getElementById('examesList');
    if (!container) return;

    const exams = this.state.exams;
    exams.sort((a, b) => this.parseLocalDate(a.date) - this.parseLocalDate(b.date));

    if (exams.length === 0) {
      container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: var(--space-24);">Nenhum exame cadastrado.</p>';
      return;
    }

    let html = '';
    exams.forEach(exam => {
      const formattedDate = this.formatDateStr(exam.date);
      
      html += `
        <div class="exam-card">
          <h4><span class="exam-icon-large">🏥</span> ${exam.type}</h4>
          <div class="exam-info">
            <div>📅 Data: ${formattedDate}</div>
            ${exam.time ? `<div>🕐 Horário: ${exam.time}</div>` : ''}
            ${exam.location ? `<div>📍 Local: ${exam.location}</div>` : ''}
            ${exam.fileName ? `<div>📎 Arquivo: ${exam.fileName}</div>` : ''}
          </div>
          ${exam.notes ? `<div class="exam-notes"><strong>Observações:</strong><br>${exam.notes}</div>` : ''}
          <div class="exam-actions">
            <button class="btn btn--sm btn--secondary" onclick="app.openExamModal('${exam.id}')">✏️ Editar</button>  <!-- Correção: Aspas ao redor do id -->
            <button class="btn btn--sm btn--secondary" onclick="app.deleteExam('${exam.id}')">🗑️ Excluir</button>  <!-- Correção: Aspas ao redor do id -->
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  // Project functions
  openProjectModal(projectId = null) {
    const modal = document.getElementById('projectModal');
    const title = document.getElementById('projectModalTitle');
    
    if (projectId) {
      this.state.editingProject = this.state.projects.find(p => p.id === projectId);
      title.textContent = 'Editar Projeto';
      document.getElementById('projectName').value = this.state.editingProject.name;
      document.getElementById('projectDescription').value = this.state.editingProject.description;
    } else {
      this.state.editingProject = null;
      title.textContent = 'Novo Projeto';
      document.getElementById('projectName').value = '';
      document.getElementById('projectDescription').value = '';
    }
    
    modal.classList.add('active');
  },

  closeProjectModal() {
    document.getElementById('projectModal').classList.remove('active');
    this.state.editingProject = null;
  },

saveProject() {
    const name = document.getElementById('projectName').value;
    const description = document.getElementById('projectDescription').value;

    if (!name) {
      alert('Por favor, digite o nome do projeto.');
      return;
    }

    const project = {
      id: this.state.editingProject ? this.state.editingProject.id : crypto.randomUUID(),
      name,
      description,
      tasks: this.state.editingProject ? this.state.editingProject.tasks : []
    };

    db.upsertProject(project)
      .then(() => {
        if (this.state.editingProject) {
          const index = this.state.projects.findIndex(p => p.id === this.state.editingProject.id);
          this.state.projects[index] = project;
        } else {
          this.state.projects.push(project);
        }
        this.closeProjectModal();
        this.renderProjects();
      })
      .catch(error => {
        console.error('Erro ao salvar projeto:', error);
        alert('Erro ao salvar projeto: ' + error.message + '. Verifique o console para detalhes.');
      });
  },

  deleteProject(projectId) {
    if (confirm('Tem certeza que deseja excluir este projeto e todas as suas tarefas?')) {
      this.state.projects = this.state.projects.filter(p => p.id !== projectId);
      this.renderProjects();
    }
    db.deleteProject(projectId).catch(console.error); // SUPABASE
  },

  openProjectTaskModal(projectId, taskId = null) {
    this.state.currentProjectId = projectId;
    const modal = document.getElementById('projectTaskModal');
    const title = document.getElementById('projectTaskModalTitle');
    
    if (taskId) {
      const project = this.state.projects.find(p => p.id === projectId);
      this.state.editingProjectTask = project.tasks.find(t => t.id === taskId);
      title.textContent = 'Editar Tarefa';
      document.getElementById('projectTaskName').value = this.state.editingProjectTask.name;
      document.getElementById('projectTaskDescription').value = this.state.editingProjectTask.description;
      document.getElementById('projectTaskState').value = this.state.editingProjectTask.state;
    } else {
      this.state.editingProjectTask = null;
      title.textContent = 'Nova Tarefa';
      document.getElementById('projectTaskName').value = '';
      document.getElementById('projectTaskDescription').value = '';
      document.getElementById('projectTaskState').value = 'fazer';
    }
    
    modal.classList.add('active');
  },

  closeProjectTaskModal() {
    document.getElementById('projectTaskModal').classList.remove('active');
    this.state.editingProjectTask = null;
    this.state.currentProjectId = null;
  },

  saveProjectTask() {
    const name = document.getElementById('projectTaskName').value;
    const description = document.getElementById('projectTaskDescription').value;
    const state = document.getElementById('projectTaskState').value;

    if (!name) {
      alert('Por favor, digite o nome da tarefa.');
      return;
    }

    const project = this.state.projects.find(p => p.id === this.state.currentProjectId);
    if (!project) return;

    const task = {
      id: this.state.editingProjectTask ? this.state.editingProjectTask.id : crypto.randomUUID(),
      name,
      description,
      state,
      timeSpent: this.state.editingProjectTask ? this.state.editingProjectTask.timeSpent : 0,
      isRunning: false,
      startTime: null
    };

    if (this.state.editingProjectTask) {
      const index = project.tasks.findIndex(t => t.id === this.state.editingProjectTask.id);
      project.tasks[index] = task;
    } else {
      project.tasks.push(task);
    }

    db.upsertProject(project)
      .then(() => db.upsertProjectTask(this.state.currentProjectId, task))
      .then(() => {
        this.closeProjectTaskModal();
        this.renderProjects();
      })
      .catch(error => {
        console.error('Erro ao salvar tarefa de projeto:', error);
        alert('Erro ao salvar tarefa de projeto: ' + error.message + '. Verifique o console para detalhes.');
      });
  },

  deleteProjectTask(projectId, taskId) {
    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
      const project = this.state.projects.find(p => p.id === projectId);
      if (project) {
        project.tasks = project.tasks.filter(t => t.id !== taskId);
        this.renderProjects();
      }
    }
    db.deleteProjectTask(taskId).catch(console.error); // SUPABASE
  },

  startTimer(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task || task.isRunning || task.state === 'concluida') return;

    task.isRunning = true;
    task.startTime = Date.now();

    db.upsertProject(project)
      .then(() => db.upsertProjectTask(projectId, task))
      .then(() => {
        this.renderProjects();
      })
      .catch(error => {
        console.error('Erro ao iniciar timer:', error);
        alert('Erro ao iniciar timer: ' + error.message + '. Verifique o console para detalhes.');
      });
  },

  pauseTimer(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task || !task.isRunning) return;

    task.timeSpent += Date.now() - task.startTime;
    task.isRunning = false;
    task.startTime = null;
    task.state = 'pausada';

    db.upsertProject(project)
      .then(() => db.upsertProjectTask(projectId, task))
      .then(() => {
        this.renderProjects();
      })
      .catch(error => {
        console.error('Erro ao pausar timer:', error);
        alert('Erro ao pausar timer: ' + error.message + '. Verifique o console para detalhes.');
      });
  },

  finishTimer(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.isRunning) {
      task.timeSpent += Date.now() - task.startTime;
      task.isRunning = false;
      task.startTime = null;
    }

    task.state = 'concluida';

    db.upsertProject(project)
      .then(() => db.upsertProjectTask(projectId, task))
      .then(() => {
        this.renderProjects();
      })
      .catch(error => {
        console.error('Erro ao finalizar tarefa:', error);
        alert('Erro ao finalizar tarefa: ' + error.message + '. Verifique o console para detalhes.');
      });
  },

  updateTimer(projectId, taskId) {
    this.renderProjects();
  },

  updateAllTimers() {
    setInterval(() => {
      let needsUpdate = false;
      this.state.projects.forEach(project => {
        project.tasks.forEach(task => {
          if (task.isRunning) {
            needsUpdate = true;
          }
        });
      });
      if (needsUpdate) {
        this.renderProjects();
      }
    }, 1000);
  },

  formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },

    renderProjects() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    const projects = this.state.projects;

    if (projects.length === 0) {
      container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: var(--space-24);">Nenhum projeto criado.</p>';
      return;
    }

    let html = '';
    projects.forEach(project => {
      const totalTime = project.tasks.reduce((sum, task) => {
        let time = task.timeSpent;
        if (task.isRunning) {
          time += Date.now() - task.startTime;
        }
        return sum + time;
      }, 0);

      html += `
        <div class="project-card">
          <div class="project-header">
            <div class="project-info">
              <h3>📊 ${project.name}</h3>
              ${project.description ? `<p>${project.description}</p>` : ''}
            </div>
            <div style="display: flex; gap: var(--space-8);">
              <button class="btn btn--sm btn--primary" onclick="app.openProjectTaskModal('${project.id}')">+ Tarefa</button>  <!-- Correção: Aspas ao redor do id -->
              <button class="btn btn--sm btn--secondary" onclick="app.openProjectModal('${project.id}')">✏️</button>  <!-- Correção: Aspas ao redor do id -->
              <button class="btn btn--sm btn--secondary" onclick="app.deleteProject('${project.id}')">🗑️</button>  <!-- Correção: Aspas ao redor do id -->
            </div>
          </div>
          
          <div class="project-time-summary">
            ⏱️ Tempo Total do Projeto: ${this.formatTime(totalTime)}
          </div>

          <div class="project-tasks">
      `;

      if (project.tasks.length === 0) {
        html += '<p style="color: var(--color-text-secondary); text-align: center; padding: var(--space-16);">Nenhuma tarefa adicionada.</p>';
      } else {
        project.tasks.forEach(task => {
          let currentTime = task.timeSpent;
          if (task.isRunning) {
            currentTime += Date.now() - task.startTime;
          }

          html += `
            <div class="project-task-item">
              <div class="project-task-header">
                <div class="project-task-title">${task.name}</div>
                <span class="task-state-badge ${task.state}">${this.getProjectTaskStateLabel(task.state)}</span>
              </div>
              ${task.description ? `<div class="project-task-description">${task.description}</div>` : ''}
              <div class="project-task-controls">
                <div class="timer-display">⏱️ ${this.formatTime(currentTime)}</div>
                ${!task.isRunning && task.state !== 'concluida' ? 
                  `<button class="btn btn--sm btn--primary" onclick="app.startTimer('${project.id}', '${task.id}')">▶️ Iniciar</button>` : ''}  <!-- Correção: Aspas ao redor dos ids -->
                ${task.isRunning ? 
                  `<button class="btn btn--sm btn--secondary" onclick="app.pauseTimer('${project.id}', '${task.id}')">⏸️ Pausar</button>` : ''}  <!-- Correção: Aspas ao redor dos ids -->
                ${task.state !== 'concluida' ? 
                  `<button class="btn btn--sm btn--primary" onclick="app.finishTimer('${project.id}', '${task.id}')">✓ Finalizar</button>` : ''}  <!-- Correção: Aspas ao redor dos ids -->
                <button class="btn btn--sm btn--secondary" onclick="app.openProjectTaskModal('${project.id}', '${task.id}')">✏️</button>  <!-- Correção: Aspas ao redor dos ids -->
                <button class="btn btn--sm btn--secondary" onclick="app.deleteProjectTask('${project.id}', '${task.id}')">🗑️</button>  <!-- Correção: Aspas ao redor dos ids -->
              </div>
            </div>
          `;
        });
      }

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  getProjectTaskStateLabel(state) {
    const labels = {
      fazer: 'A Fazer',
      pausada: 'Pausada',
      concluida: 'Concluída'
    };
    return labels[state] || state;
  },

  // Notifications
  checkNotifications() {
    if (!this.state.settings.enableNotifications) return;

    const now = new Date();
    const notificationTime = this.state.settings.notificationTime;

      this.state.tasks.forEach(task => {
    if (!task.date) return;

    const taskDate = this.parseLocalDate(task.date);
    if (task.time) {
      const [hours, minutes] = task.time.split(':').map(Number);
      taskDate.setHours(hours, minutes);
    }

    const now = new Date();
    const timeDiff = taskDate - now;
    const minutesDiff = Math.floor(timeDiff / 60000);

    // não notifica itens já passados
    if (minutesDiff < 0) return;

    if (minutesDiff === notificationTime && !this.state.notified.tasks[task.id]) {
      this.showNotification(task);
      this.state.notified.tasks[task.id] = true; // marca como notificado
    }
  });


        this.state.exams.forEach(exam => {
      if (!exam.date) return;

      const examDate = this.parseLocalDate(exam.date);
      if (exam.time) {
        const [hours, minutes] = exam.time.split(':').map(Number);
        examDate.setHours(hours, minutes);
      }

      const now = new Date();
      const timeDiff = examDate - now;
      const minutesDiff = Math.floor(timeDiff / 60000);

      if (minutesDiff < 0) return;

      if (minutesDiff === notificationTime && !this.state.notified.exams[exam.id]) {
        // use a mesma função de alerta que você já usa
        alert(
          `📋 Lembrete de Exame: ${exam.type}\n\n` +
          `Data: ${exam.date}\n` +
          `Horário: ${exam.time || '--:--'}\n` +
          `Local: ${exam.location || '-'}`
        );
        this.state.notified.exams[exam.id] = true; // marca como notificado
      }
    });
  },

  showNotification(task) {
    alert(`🔔 Lembrete: ${task.title}\n\nA tarefa está próxima!\nData: ${this.formatDateStr(task.date)}${task.time ? '\nHorário: ' + task.time : ''}`);
  },

  showExamNotification(exam) {
    alert(`🏥 Lembrete de Exame: ${exam.type}\n\nData: ${this.formatDateStr(exam.date)}${exam.time ? '\nHorário: ' + exam.time : ''}${exam.location ? '\nLocal: ' + exam.location : ''}`);
  },

  // Pomodoro Timer Functions
  initPomodoro() {
    this.updatePomodoroDisplay();
    this.initAudio();
  },

  // HTML5 Audio Functions
  initAudio() {
    // Create HTML5 Audio element for pomodoro.mp3
    this.audioElement = new Audio('pomodoro.mp3');
    this.audioElement.loop = true; // Enable looping
    this.audioElement.volume = this.state.pomodoro.audio.volume;
    
    // Listen for audio events
    this.audioElement.addEventListener('canplaythrough', () => {
      console.log('Audio loaded successfully');
      this.audioReady = true;
      this.updateAudioStatusText('✅ Áudio carregado! Clique em "Iniciar" para começar');
    });
    
    this.audioElement.addEventListener('error', (e) => {
      console.error('Audio loading error:', e);
      this.updateAudioStatusText('❌ Erro ao carregar áudio. Verifique o arquivo pomodoro.mp3');
    });
    
    this.audioElement.addEventListener('play', () => {
      console.log('Audio started playing');
      this.state.pomodoro.audio.isPlaying = true;
    });
    
    this.audioElement.addEventListener('pause', () => {
      console.log('Audio paused');
      this.state.pomodoro.audio.isPlaying = false;
    });
    
    // Preload the audio
    this.audioElement.load();
    
    // Update UI
    this.updateAudioUI();
  },



  startAudio() {
    if (!this.audioElement || !this.audioReady) {
      console.warn('Audio not ready yet');
      this.updateAudioStatusText('⏳ Aguardando áudio carregar...');
      return;
    }
    
    try {
      const playPromise = this.audioElement.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.state.pomodoro.audio.isPlaying = true;
            this.updateAudioStatusText('🎵 Áudio Pomodoro reproduzindo para concentração...');
            console.log('Audio started successfully');
          })
          .catch((error) => {
            console.error('Error playing audio:', error);
            this.updateAudioStatusText('❌ Erro ao reproduzir áudio. Clique novamente.');
          });
      }
    } catch (e) {
      console.error('Error starting audio:', e);
    }
  },

  stopAudio() {
    if (!this.audioElement) return;
    
    try {
      this.audioElement.pause();
      this.audioElement.currentTime = 0; // Reset to beginning
      this.state.pomodoro.audio.isPlaying = false;
      console.log('Audio stopped');
    } catch (e) {
      console.error('Error stopping audio:', e);
    }
  },

  pauseAudio() {
    if (!this.audioElement) return;
    
    try {
      this.audioElement.pause();
      this.state.pomodoro.audio.isPlaying = false;
      console.log('Audio paused');
    } catch (e) {
      console.error('Error pausing audio:', e);
    }
  },

  changeVolume(value) {
    const volumeDisplay = document.getElementById('volumeValue');
    
    if (!volumeDisplay) return;
    
    const volume = parseInt(value) / 100;
    this.state.pomodoro.audio.volume = volume;
    
    // Update HTML5 Audio volume
    if (this.audioElement) {
      this.audioElement.volume = volume;
    }
    
    volumeDisplay.textContent = value + '%';
  },

  toggleAudio() {
    this.state.pomodoro.audio.enabled = !this.state.pomodoro.audio.enabled;
    
    if (this.state.pomodoro.audio.enabled) {
      // If timer is running, start audio
      if (this.state.pomodoro.isRunning) {
        this.startAudio();
      }
    } else {
      // Stop audio
      this.pauseAudio();
    }
    
    this.updateAudioUI();
  },

  updateAudioUI() {
    const toggleBtn = document.getElementById('audioToggleBtn');
    const toggleIcon = document.getElementById('audioToggleIcon');
    const toggleText = document.getElementById('audioToggleText');
    
    if (!toggleBtn || !toggleIcon || !toggleText) return;
    
    if (this.state.pomodoro.audio.enabled) {
      toggleIcon.textContent = '🔊';
      toggleText.textContent = 'Áudio Ativado';
      toggleBtn.classList.remove('btn--secondary');
      toggleBtn.classList.add('btn--primary');
      
      if (this.state.pomodoro.isRunning) {
        this.updateAudioStatusText('🎵 Áudio Pomodoro reproduzindo para concentração...');
      } else {
        this.updateAudioStatusText('✅ Pronto! Clique em "Iniciar" para começar');
      }
    } else {
      toggleIcon.textContent = '🔇';
      toggleText.textContent = 'Áudio Desativado';
      toggleBtn.classList.remove('btn--primary');
      toggleBtn.classList.add('btn--secondary');
      this.updateAudioStatusText('⚠️ Áudio desativado');
    }
  },

  updateAudioStatusText(text) {
    const statusText = document.getElementById('audioStatusText');
    if (statusText) {
      statusText.textContent = text;
    }
  },

  playPomodoroAudio() {
    if (!this.state.pomodoro.audio.enabled) return;
    
    console.log('Starting audio...');
    this.startAudio();
  },

  pausePomodoroAudio() {
    console.log('Pausing audio...');
    this.pauseAudio();
    
    if (this.state.pomodoro.audio.enabled) {
      this.updateAudioStatusText('⏸️ Áudio pausado');
    }
  },

  resetPomodoroAudio() {
    console.log('Resetting audio...');
    this.stopAudio();
    
    if (this.state.pomodoro.audio.enabled) {
      this.updateAudioStatusText('✅ Áudio resetado - Pronto para iniciar');
    }
  },

  applyPomodoroSettings() {
    const focusTime = parseInt(document.getElementById('focusTime').value);
    const breakTime = parseInt(document.getElementById('breakTime').value);
    
    if (focusTime < 1 || focusTime > 120) {
      alert('O tempo de concentração deve estar entre 1 e 120 minutos.');
      return;
    }
    
    if (breakTime < 1 || breakTime > 60) {
      alert('O tempo de descanso deve estar entre 1 e 60 minutos.');
      return;
    }
    
    // Only apply if timer is not running
    if (this.state.pomodoro.isRunning) {
      alert('Pause o temporizador antes de alterar as configurações.');
      return;
    }
    
    this.state.pomodoro.focusTime = focusTime;
    this.state.pomodoro.breakTime = breakTime;
    
    // Reset to new focus time
    this.state.pomodoro.mode = 'focus';
    this.state.pomodoro.currentTime = focusTime * 60;
    this.updatePomodoroDisplay();
    
    alert('✓ Configurações aplicadas com sucesso!');
  },

  startPomodoro() {
    if (!this.state.pomodoro.isRunning) {
      this.state.pomodoro.isRunning = true;
      this.state.pomodoro.isPaused = false;
      
      // Add visual effect
      document.getElementById('pomodoroContainer').classList.add('timer-running');
      
      // Update button visibility
      document.getElementById('pomodoroStartBtn').style.display = 'none';
      document.getElementById('pomodoroPauseBtn').style.display = 'inline-flex';
      
      // Start audio
      this.playPomodoroAudio();
      
      // Start countdown
      this.state.pomodoro.intervalId = setInterval(() => {
        this.state.pomodoro.currentTime--;
        
        if (this.state.pomodoro.currentTime <= 0) {
          this.pomodoroComplete();
        } else {
          this.updatePomodoroDisplay();
        }
      }, 1000);
    }
  },

  pausePomodoro() {
    if (this.state.pomodoro.isRunning) {
      this.state.pomodoro.isRunning = false;
      this.state.pomodoro.isPaused = true;
      
      // Remove visual effect
      document.getElementById('pomodoroContainer').classList.remove('timer-running');
      
      // Update button visibility
      document.getElementById('pomodoroStartBtn').style.display = 'inline-flex';
      document.getElementById('pomodoroPauseBtn').style.display = 'none';
      
      // Pause audio
      this.pausePomodoroAudio();
      
      // Stop countdown
      if (this.state.pomodoro.intervalId) {
        clearInterval(this.state.pomodoro.intervalId);
        this.state.pomodoro.intervalId = null;
      }
    }
  },

  resetPomodoro() {
    // Stop timer if running
    if (this.state.pomodoro.isRunning) {
      this.pausePomodoro();
    }
    
    // Stop and reset audio
    this.resetPomodoroAudio();
    
    // Reset to focus mode
    this.state.pomodoro.mode = 'focus';
    this.state.pomodoro.currentTime = this.state.pomodoro.focusTime * 60;
    this.state.pomodoro.isPaused = false;
    
    // Update display
    this.updatePomodoroDisplay();
    this.updateAudioUI();
    
    // Reset button visibility
    document.getElementById('pomodoroStartBtn').style.display = 'inline-flex';
    document.getElementById('pomodoroPauseBtn').style.display = 'none';
  },

  pomodoroComplete() {
    // Stop timer
    if (this.state.pomodoro.intervalId) {
      clearInterval(this.state.pomodoro.intervalId);
      this.state.pomodoro.intervalId = null;
    }
    
    this.state.pomodoro.isRunning = false;
    
    // Remove visual effect
    document.getElementById('pomodoroContainer').classList.remove('timer-running');
    
    // Pause audio
    this.pausePomodoroAudio();
    
    // Show notification based on current mode
    if (this.state.pomodoro.mode === 'focus') {
      alert('🎉 Parabéns! Tempo de concentração completo!\n\n☕ Hora de fazer uma pausa e descansar.');
      
      // Switch to break mode
      this.state.pomodoro.mode = 'break';
      this.state.pomodoro.currentTime = this.state.pomodoro.breakTime * 60;
    } else {
      alert('✅ Tempo de descanso completo!\n\n🎯 Pronto para voltar a focar?');
      
      // Switch back to focus mode
      this.state.pomodoro.mode = 'focus';
      this.state.pomodoro.currentTime = this.state.pomodoro.focusTime * 60;
    }
    
    // Update display
    this.updatePomodoroDisplay();
    this.updateAudioUI();
    
    // Reset button visibility
    document.getElementById('pomodoroStartBtn').style.display = 'inline-flex';
    document.getElementById('pomodoroPauseBtn').style.display = 'none';
  },

  updatePomodoroDisplay() {
    const minutes = Math.floor(this.state.pomodoro.currentTime / 60);
    const seconds = this.state.pomodoro.currentTime % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const timerElement = document.getElementById('pomodoroTimer');
    const modeElement = document.getElementById('pomodoroModeText');
    const modeIndicator = document.querySelector('.pomodoro-mode-indicator');
    
    if (timerElement) {
      timerElement.textContent = timeString;
    }
    
    if (modeElement && modeIndicator) {
      if (this.state.pomodoro.mode === 'focus') {
        modeElement.textContent = '🎯 Concentração';
        modeIndicator.classList.remove('break-mode');
      } else {
        modeElement.textContent = '☕ Descanso';
        modeIndicator.classList.add('break-mode');
      }
    }
  }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}
