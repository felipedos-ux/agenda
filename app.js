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
        alarm: !!row.alarm,
        createdAt: row.created_at || new Date().toISOString()
      };
    });
  },

  async upsertTask(task) {
    const statusMapOut = {
      'pendente': 'afazer',
      'andamento': 'andamento',
      'concluida': 'concluida'
    };
    const normalizedStatus = statusMapOut[(task.status || '').toLowerCase()] || 'afazer';

    const payload = {
      id: String(task.id),
      title: (task.title ?? task.name ?? '').toString(),
      description: task.description ?? null,
      date: task.date ?? null,
      time: task.time ?? null,
      priority: task.priority ?? 'normal',
      status: normalizedStatus,
      updated_at: new Date().toISOString()
    };

    if (!task.createdAt) {
      payload.created_at = new Date().toISOString();
    }

    // ✅ MELHORADO: Adiciona .select() para retornar dados
    const { data, error } = await this.client
      .from('tasks')
      .upsert(payload)
      .select()
      .single();
      
    if (error) {
      console.error('Erro ao salvar tarefa no Supabase:', error);
      throw error;
    }
    
    return data;
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

    // ✅ MELHORADO: Adiciona .select() para retornar dados
    const { data, error } = await this.client
      .from('exams')
      .upsert(payload)
      .select()
      .single();
      
    if (error) {
      console.error('Erro ao salvar exame:', error);
      throw error;
    }
    
    return data;
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

    // ✅ MELHORADO: Adiciona .select() para retornar dados
    const { data, error } = await this.client
      .from('shopping_items')
      .upsert(payload)
      .select()
      .single();
      
    if (error) {
      console.error('Erro ao salvar item de compra:', error);
      throw error;
    }
    
    return data;
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
        createdAt: t.created_at || null
      });
    });

    return (projects || []).map(p => ({
      id: p.id,
      name: p.name || '',
      description: p.description || '',
      createdAt: p.created_at || null,
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

    // ✅ MELHORADO: Adiciona .select() para retornar dados
    const { data, error } = await this.client
      .from('projects')
      .upsert(payload)
      .select()
      .single();
      
    if (error) {
      console.error('Erro ao salvar projeto:', error);
      throw error;
    }
    
    return data;
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

    // ✅ MELHORADO: Adiciona .select() para retornar dados
    const { data, error } = await this.client
      .from('project_tasks')
      .upsert(payload)
      .select()
      .single();
      
    if (error) {
      console.error('Erro ao salvar tarefa de projeto:', error);
      throw error;
    }
    
    return data;
  },

  async updateProjectTaskTimer(projectId, task) {
    return this.upsertProjectTask(projectId, task);
  },

  async deleteProjectTask(id) {
    const { error } = await this.client.from('project_tasks').delete().eq('id', String(id));
    if (error) throw error;
  },

  // ✅ NOVO: Método para deletar projeto
  async deleteProject(id) {
    const { error } = await this.client
      .from('projects')
      .delete()
      .eq('id', String(id));
      
    if (error) {
      console.error('Erro ao deletar projeto:', error);
      throw error;
    }
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

// ===== HELPERS E UTILIDADES (ADICIONADO) =====
const dbOperations = {
  async safeOperation(operation, errorMessage) {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      console.error(errorMessage, error);
      this.showNotification(errorMessage, 'error');
      return { success: false, error };
    }
  },
  
  showNotification(message, type = 'info') {
    if (type === 'error') {
      alert('❌ ' + message);
    } else if (type === 'success') {
      console.log('✅ ' + message);
    }
  }
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const validators = {
  task(task) {
    const errors = [];
    if (!task.title || task.title.trim() === '') {
      errors.push('Título é obrigatório');
    }
    if (!task.date) {
      errors.push('Data é obrigatória');
    } else if (!this.isValidDate(task.date)) {
      errors.push('Data inválida');
    }
    if (task.time && !this.isValidTime(task.time)) {
      errors.push('Horário inválido');
    }
    if (!['urgente', 'normal', 'baixa'].includes(task.priority)) {
      errors.push('Prioridade inválida');
    }
    return { valid: errors.length === 0, errors };
  },
  
  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  },
  
  isValidTime(timeString) {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return regex.test(timeString);
  },
  
  project(project) {
    const errors = [];
    if (!project.name || project.name.trim() === '') {
      errors.push('Nome do projeto é obrigatório');
    }
    return { valid: errors.length === 0, errors };
  },
  
  exam(exam) {
    const errors = [];
    if (!exam.type || exam.type.trim() === '') {
      errors.push('Tipo de exame é obrigatório');
    }
    if (!exam.date) {
      errors.push('Data é obrigatória');
    } else if (!this.isValidDate(exam.date)) {
      errors.push('Data inválida');
    }
    return { valid: errors.length === 0, errors };
  }
};

const logger = {
  logs: [],
  maxLogs: 100,
  
  log(level, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    const prefix = {
      'info': 'ℹ️',
      'warn': '⚠️',
      'error': '❌',
      'success': '✅'
    }[level] || '📝';
    console.log(`${prefix} [${level.toUpperCase()}] ${message}`, data || '');
  },
  
  info(message, data) { this.log('info', message, data); },
  warn(message, data) { this.log('warn', message, data); },
  error(message, data) { this.log('error', message, data); },
  success(message, data) { this.log('success', message, data); },
  
  getLogs(level = null) {
    if (!level) return this.logs;
    return this.logs.filter(log => log.level === level);
  }
};

const app = {
  // State management (in-memory)
  state: {
    notified: {
      tasks: {},
      exams: {}
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
    timerSaveTimeout: null, // ✅ NOVO
    pomodoro: {
      focusTime: 25,
      breakTime: 5,
      currentTime: 25 * 60,
      isRunning: false,
      isPaused: false,
      mode: 'focus',
      intervalId: null,
      audio: {
        enabled: true,
        volume: 0.7,
        currentSource: 'bluenoise',
        isPlaying: false
      }
    }
  },

  // ✅ MELHORADO: init com correção de timers órfãos
  async init() {
    db.init();
    
    try {
      await db.loadAllInto(this.state);
      
      // ✅ NOVO: Corrigir timers órfãos
      await this.fixOrphanedTimers();
      
    } catch (e) {
      console.warn("Load Supabase falhou:", e);
    }
    
    this.setDefaultDates();
    this.setupEventListeners();
    this.setupHamburgerMenu();
    this.renderTasksDashboard();
    this.renderCalendar();
    this.renderTasks();
    this.checkNotifications();
    setInterval(() => this.checkNotifications(), 60000);
    this.updateAllTimers();
    this.initPomodoro();
  },

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

  parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  },

  formatDateStr(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  },

  setupHamburgerMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sideMenu = document.getElementById('sideMenu');
    const sideMenuOverlay = document.getElementById('sideMenuOverlay');
    const closeSideMenu = document.getElementById('closeSideMenu');

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => {
        sideMenu.classList.add('active');
        sideMenuOverlay.classList.add('active');
      });
    }

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

    document.querySelectorAll('.side-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
        closeSideMenuFunc();
        document.querySelectorAll('.side-menu-item').forEach(btn => {
          btn.classList.remove('active');
        });
        e.target.classList.add('active');
      });
    });
  },

  setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    document.getElementById('themeToggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  },

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

  toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-color-scheme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-color-scheme', newTheme);
    document.getElementById('themeIcon').textContent = newTheme === 'dark' ? '☀️' : '🌙';
  },

  // ===== TASK MANAGEMENT =====

  openNewTaskModal() {
    this.state.editingTask = null;
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('taskDate').value = `${year}-${month}-${day}`;
    document.getElementById('taskTime').value = '';
    document.getElementById('taskPriority').value = 'normal';
    document.getElementById('taskStatus').value = 'pendente';
    document.getElementById('taskAlarm').checked = false;
    document.getElementById('taskModal').classList.add('active');
  },

  editTask(taskId) {
    const task = this.state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    this.state.editingTask = task;
    document.getElementById('taskTitle').value = task.title || task.name || '';
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskDate').value = task.date || '';
    document.getElementById('taskTime').value = task.time || '';
    document.getElementById('taskPriority').value = task.priority || 'normal';
    document.getElementById('taskStatus').value = task.status || 'pendente';
    document.getElementById('taskAlarm').checked = !!task.alarm;
    document.getElementById('taskModal').classList.add('active');
  },

  // ✅ MELHORADO: saveTask com validação e tratamento de erro
  async saveTask() {
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

    // ✅ NOVO: Validação
    const validation = validators.task(task);
    if (!validation.valid) {
      alert('Erros de validação:\n' + validation.errors.join('\n'));
      return;
    }

    // Desabilitar botão
    const saveButton = document.querySelector('#taskModal .btn--primary');
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Salvando...';
    }

    try {
      // ✅ MELHORADO: Salvar no banco PRIMEIRO
      await db.upsertTask(task);
      
      // Depois atualizar estado local
      if (this.state.editingTask) {
        const index = this.state.tasks.findIndex(t => t.id === this.state.editingTask.id);
        this.state.tasks[index] = task;
      } else {
        this.state.tasks.push(task);
      }

      this.closeTaskModal();
      
      // Recarregar do banco para garantir consistência
      await this.reloadTasks();
      
      logger.success('Tarefa salva com sucesso', task);
      
    } catch (error) {
      logger.error('Erro ao salvar tarefa', error);
      alert('❌ Erro ao salvar tarefa. Por favor, tente novamente.');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar';
      }
    }
  },

  // ✅ MELHORADO: deleteTask com padrão optimistic update + rollback
  async deleteTask(taskId) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    
    // Salvar estado anterior para rollback
    const previousTasks = [...this.state.tasks];
    
    // Atualização otimista da UI
    this.state.tasks = this.state.tasks.filter(t => String(t.id) !== String(taskId));
    this.renderTasks();
    this.renderTasksDashboard();
    this.renderCalendar();
    
    // Tentar deletar no banco
    const result = await dbOperations.safeOperation(
      () => db.deleteTask(taskId),
      'Erro ao excluir tarefa'
    );
    
    // Se falhou, fazer rollback
    if (!result.success) {
      this.state.tasks = previousTasks;
      this.renderTasks();
      this.renderTasksDashboard();
      this.renderCalendar();
      logger.error('Rollback executado após falha ao deletar tarefa', taskId);
      return;
    }
    
    // Recarregar do banco para garantir consistência
    await this.reloadTasks();
    logger.success('Tarefa deletada com sucesso', taskId);
  },

  closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
    this.state.editingTask = null;
  },

  // ✅ NOVO: Método para recarregar tarefas
  async reloadTasks() {
    try {
      this.state.tasks = await db.loadTasks();
      this.renderTasks();
      this.renderTasksDashboard();
      this.renderCalendar();
      logger.info('Tarefas recarregadas do banco');
    } catch (error) {
      logger.error('Erro ao recarregar tarefas', error);
    }
  },

  // ===== EXAM MANAGEMENT =====

  openNewExamModal() {
    this.state.editingExam = null;
    document.getElementById('examType').value = '';
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('examDate').value = `${year}-${month}-${day}`;
    document.getElementById('examTime').value = '';
    document.getElementById('examLocation').value = '';
    document.getElementById('examNotes').value = '';
    document.getElementById('examFile').value = '';
    document.getElementById('examModal').classList.add('active');
  },

  editExam(examId) {
    const exam = this.state.exams.find(e => String(e.id) === String(examId));
    if (!exam) return;

    this.state.editingExam = exam;
    document.getElementById('examType').value = exam.type || '';
    document.getElementById('examDate').value = exam.date || '';
    document.getElementById('examTime').value = exam.time || '';
    document.getElementById('examLocation').value = exam.location || '';
    document.getElementById('examNotes').value = exam.notes || '';
    document.getElementById('examModal').classList.add('active');
  },

  // ✅ MELHORADO: saveExam com validação e tratamento de erro
  async saveExam() {
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
      id: this.state.editingExam ? this.state.editingExam.id : String(Date.now()),
      type,
      date,
      time,
      location,
      notes,
      fileName: fileInput.files[0]?.name || (this.state.editingExam?.fileName || null)
    };

    // ✅ NOVO: Validação
    const validation = validators.exam(exam);
    if (!validation.valid) {
      alert('Erros de validação:\n' + validation.errors.join('\n'));
      return;
    }

    try {
      // ✅ MELHORADO: Salvar no banco PRIMEIRO
      await db.upsertExam(exam);
      
      // Depois atualizar estado local
      if (this.state.editingExam) {
        const index = this.state.exams.findIndex(e => e.id === this.state.editingExam.id);
        this.state.exams[index] = exam;
      } else {
        this.state.exams.push(exam);
      }

      this.closeExamModal();
      this.renderExams();
      this.renderTasksDashboard();
      
      logger.success('Exame salvo com sucesso', exam);
      
    } catch (error) {
      logger.error('Erro ao salvar exame', error);
      alert('❌ Erro ao salvar exame. Por favor, tente novamente.');
    }
  },

  // ✅ MELHORADO: deleteExam com padrão optimistic update
  async deleteExam(examId) {
    if (!confirm('Tem certeza que deseja excluir este exame?')) return;
    
    const previousExams = [...this.state.exams];
    
    this.state.exams = this.state.exams.filter(e => String(e.id) !== String(examId));
    this.renderExams();
    this.renderTasksDashboard();
    
    const result = await dbOperations.safeOperation(
      () => db.deleteExam(examId),
      'Erro ao excluir exame'
    );
    
    if (!result.success) {
      this.state.exams = previousExams;
      this.renderExams();
      this.renderTasksDashboard();
      logger.error('Rollback executado após falha ao deletar exame', examId);
      return;
    }
    
    await this.reloadExams();
    logger.success('Exame deletado com sucesso', examId);
  },

  closeExamModal() {
    document.getElementById('examModal').classList.remove('active');
    this.state.editingExam = null;
  },

  // ✅ NOVO: Método para recarregar exames
  async reloadExams() {
    try {
      this.state.exams = await db.loadExams();
      this.renderExams();
      this.renderTasksDashboard();
      logger.info('Exames recarregados do banco');
    } catch (error) {
      logger.error('Erro ao recarregar exames', error);
    }
  },

  // ===== PROJECT MANAGEMENT =====

  openNewProjectModal() {
    this.state.editingProject = null;
    document.getElementById('projectName').value = '';
    document.getElementById('projectDescription').value = '';
    document.getElementById('projectModal').classList.add('active');
  },

  editProject(projectId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;

    this.state.editingProject = project;
    document.getElementById('projectName').value = project.name || '';
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectModal').classList.add('active');
  },

  // ✅ MELHORADO: saveProject com validação e tratamento de erro
  async saveProject() {
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

    // ✅ NOVO: Validação
    const validation = validators.project(project);
    if (!validation.valid) {
      alert('Erros de validação:\n' + validation.errors.join('\n'));
      return;
    }

    try {
      // ✅ MELHORADO: Salvar no banco PRIMEIRO
      await db.upsertProject(project);
      
      // Depois atualizar estado local
      if (this.state.editingProject) {
        const index = this.state.projects.findIndex(p => p.id === this.state.editingProject.id);
        this.state.projects[index] = project;
      } else {
        this.state.projects.push(project);
      }

      this.closeProjectModal();
      this.renderProjects();
      
      logger.success('Projeto salvo com sucesso', project);
      
    } catch (error) {
      logger.error('Erro ao salvar projeto', error);
      alert(`❌ Erro ao salvar projeto: ${error.message}`);
    }
  },

  // ✅ MELHORADO: deleteProject deleta tasks primeiro
  async deleteProject(projectId) {
    if (!confirm('Tem certeza que deseja excluir este projeto e todas as suas tarefas?')) return;
    
    const previousProjects = [...this.state.projects];
    
    // Encontrar o projeto e suas tarefas
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Atualização otimista
    this.state.projects = this.state.projects.filter(p => p.id !== projectId);
    this.renderProjects();
    
    try {
      // ✅ MELHORADO: Deletar todas as tarefas primeiro
      for (const task of project.tasks) {
        await db.deleteProjectTask(task.id);
      }
      
      // Depois deletar o projeto
      await db.deleteProject(projectId);
      
      // Recarregar do banco
      await this.reloadProjects();
      
      logger.success('Projeto deletado com sucesso', projectId);
      
    } catch (error) {
      logger.error('Erro ao deletar projeto', error);
      alert('❌ Erro ao excluir projeto. Por favor, tente novamente.');
      
      // Rollback
      this.state.projects = previousProjects;
      this.renderProjects();
    }
  },

  closeProjectModal() {
    document.getElementById('projectModal').classList.remove('active');
    this.state.editingProject = null;
  },

  // ✅ NOVO: Método para recarregar projetos
  async reloadProjects() {
    try {
      this.state.projects = await db.loadProjectsWithTasks();
      this.renderProjects();
      logger.info('Projetos recarregados do banco');
    } catch (error) {
      logger.error('Erro ao recarregar projetos', error);
    }
  },

  openNewProjectTaskModal(projectId) {
    this.state.editingProjectTask = null;
    this.state.currentProjectId = projectId;
    document.getElementById('projectTaskName').value = '';
    document.getElementById('projectTaskDescription').value = '';
    document.getElementById('projectTaskState').value = 'fazer';
    document.getElementById('projectTaskModal').classList.add('active');
  },

  async saveProjectTask() {
    const name = document.getElementById('projectTaskName').value;
    const description = document.getElementById('projectTaskDescription').value;
    const state = document.getElementById('projectTaskState').value;

    if (!name) {
      alert('Por favor, digite o nome da tarefa.');
      return;
    }

    const task = {
      id: this.state.editingProjectTask ? this.state.editingProjectTask.id : crypto.randomUUID(),
      name,
      description,
      state,
      timeSpent: this.state.editingProjectTask ? this.state.editingProjectTask.timeSpent : 0,
      isRunning: this.state.editingProjectTask ? this.state.editingProjectTask.isRunning : false,
      startTime: this.state.editingProjectTask ? this.state.editingProjectTask.startTime : null
    };

    const projectId = this.state.currentProjectId;
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;

    try {
      await db.upsertProject(project);
      await db.upsertProjectTask(projectId, task);

      if (this.state.editingProjectTask) {
        const index = project.tasks.findIndex(t => t.id === this.state.editingProjectTask.id);
        project.tasks[index] = task;
      } else {
        project.tasks.push(task);
      }

      this.closeProjectTaskModal();
      this.renderProjects();
      
      logger.success('Tarefa de projeto salva', task);
    } catch (error) {
      logger.error('Erro ao salvar tarefa de projeto', error);
      alert(`❌ Erro: ${error.message}`);
    }
  },

  async deleteProjectTask(projectId, taskId) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;

    const previousTasks = [...project.tasks];
    project.tasks = project.tasks.filter(t => t.id !== taskId);
    this.renderProjects();

    try {
      await db.deleteProjectTask(taskId);
      await db.upsertProject(project);
      logger.success('Tarefa de projeto deletada', taskId);
    } catch (error) {
      logger.error('Erro ao deletar tarefa de projeto', error);
      project.tasks = previousTasks;
      this.renderProjects();
      alert(`❌ Erro: ${error.message}`);
    }
  },

  closeProjectTaskModal() {
    document.getElementById('projectTaskModal').classList.remove('active');
    this.state.editingProjectTask = null;
    this.state.currentProjectId = null;
  },

  // ===== PROJECT TIMER FUNCTIONS =====

  // ✅ MELHORADO: startTimer com tratamento de erro
  async startTimer(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    const task = project.tasks.find(t => t.id === taskId);
    if (!task || task.isRunning || task.state === 'concluida') return;
    
    task.isRunning = true;
    task.startTime = Date.now();
    
    try {
      await db.upsertProject(project);
      await db.upsertProjectTask(projectId, task);
      this.renderProjects();
      logger.info('Timer iniciado', { projectId, taskId });
    } catch (error) {
      logger.error('Erro ao iniciar timer', error);
      alert(`❌ Erro ao iniciar timer: ${error.message}`);
      
      // Rollback
      task.isRunning = false;
      task.startTime = null;
      this.renderProjects();
    }
  },

  // ✅ MELHORADO: pauseTimer com tratamento de erro
  async pauseTimer(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    const task = project.tasks.find(t => t.id === taskId);
    if (!task || !task.isRunning) return;
    
    task.timeSpent += (Date.now() - task.startTime);
    task.isRunning = false;
    task.startTime = null;
    task.state = 'pausada';
    
    try {
      await db.upsertProject(project);
      await db.upsertProjectTask(projectId, task);
      this.renderProjects();
      logger.info('Timer pausado', { projectId, taskId });
    } catch (error) {
      logger.error('Erro ao pausar timer', error);
      alert(`❌ Erro ao pausar timer: ${error.message}`);
    }
  },

  // ✅ MELHORADO: finishTimer com tratamento de erro
  async finishTimer(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    if (task.isRunning) {
      task.timeSpent += (Date.now() - task.startTime);
      task.isRunning = false;
      task.startTime = null;
    }
    
    task.state = 'concluida';
    
    try {
      await db.upsertProject(project);
      await db.upsertProjectTask(projectId, task);
      this.renderProjects();
      logger.success('Tarefa finalizada', { projectId, taskId });
    } catch (error) {
      logger.error('Erro ao finalizar tarefa', error);
      alert(`❌ Erro ao finalizar tarefa: ${error.message}`);
    }
  },

  formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  // ✅ MELHORADO: updateAllTimers com auto-save
  updateAllTimers() {
    setInterval(() => {
      let needsUpdate = false;
      let needsSave = false;
      
      this.state.projects.forEach(project => {
        project.tasks.forEach(task => {
          if (task.isRunning) {
            needsUpdate = true;
            needsSave = true;
          }
        });
      });
      
      if (needsUpdate) {
        this.renderProjects();
      }
      
      // ✅ MELHORADO: Auto-save a cada 5 segundos quando tem timer rodando
      if (needsSave && !this.state.timerSaveTimeout) {
        this.state.timerSaveTimeout = setTimeout(() => {
          this.saveRunningTimers();
          this.state.timerSaveTimeout = null;
        }, 5000);
      }
    }, 1000);
  },

  // ✅ NOVO: Método para salvar timers rodando
  async saveRunningTimers() {
    for (const project of this.state.projects) {
      for (const task of project.tasks) {
        if (task.isRunning) {
          try {
            await db.upsertProjectTask(project.id, task);
          } catch (error) {
            logger.error('Erro ao auto-salvar timer', error);
          }
        }
      }
    }
  },

  // ✅ NOVO: Corrigir timers órfãos ao carregar
  async fixOrphanedTimers() {
    let hasOrphans = false;
    
    for (const project of this.state.projects) {
      for (const task of project.tasks) {
        if (task.isRunning && task.startTime) {
          // Timer ficou rodando - calcular tempo decorrido
          const elapsed = Date.now() - task.startTime;
          task.timeSpent += elapsed;
          task.isRunning = false;
          task.startTime = null;
          hasOrphans = true;
          
          logger.warn(`Timer órfão corrigido: ${task.name} (+${Math.floor(elapsed/1000)}s)`);
        }
      }
    }
    
    // Salvar correções no banco
    if (hasOrphans) {
      for (const project of this.state.projects) {
        for (const task of project.tasks) {
          try {
            await db.upsertProjectTask(project.id, task);
          } catch (error) {
            logger.error('Erro ao corrigir timer órfão', error);
          }
        }
      }
    }
  },

  // ===== SHOPPING LIST MANAGEMENT =====

  changeShoppingList(listType) {
    this.state.currentShoppingList = listType;
    this.renderShoppingList();
  },

  async addShoppingItem() {
    const input = document.getElementById(`${this.state.currentShoppingList}Input`);
    const qtyInput = document.getElementById(`${this.state.currentShoppingList}Qty`);
    const priceInput = document.getElementById(`${this.state.currentShoppingList}Price`);
    
    const name = input.value.trim();
    const qty = parseInt(qtyInput.value) || 1;
    const price = parseFloat(priceInput.value) || 0;

    if (!name) return;

    const item = {
      id: String(Date.now()),
      name,
      qty,
      price,
      purchased: false
    };

    try {
      await db.upsertShoppingItem(this.state.currentShoppingList, item);
      this.state.shoppingLists[this.state.currentShoppingList].push(item);
      
      input.value = '';
      qtyInput.value = '1';
      priceInput.value = '';
      
      this.renderShoppingList();
      logger.success('Item adicionado', item);
    } catch (error) {
      logger.error('Erro ao adicionar item', error);
      alert('❌ Erro ao adicionar item.');
    }
  },

  async toggleShoppingItem(itemId) {
    const items = this.state.shoppingLists[this.state.currentShoppingList];
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    item.purchased = !item.purchased;

    try {
      await db.upsertShoppingItem(this.state.currentShoppingList, item);
      this.renderShoppingList();
    } catch (error) {
      logger.error('Erro ao atualizar item', error);
      item.purchased = !item.purchased;
      this.renderShoppingList();
    }
  },

  async deleteShoppingItem(itemId) {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    const items = this.state.shoppingLists[this.state.currentShoppingList];
    const previousItems = [...items];
    
    this.state.shoppingLists[this.state.currentShoppingList] = items.filter(i => i.id !== itemId);
    this.renderShoppingList();

    try {
      await db.deleteShoppingItem(itemId);
      logger.success('Item deletado', itemId);
    } catch (error) {
      logger.error('Erro ao deletar item', error);
      this.state.shoppingLists[this.state.currentShoppingList] = previousItems;
      this.renderShoppingList();
      alert('❌ Erro ao deletar item.');
    }
  },

  editShoppingItem: debounce(async function(type, itemId) {
    const item = this.state.shoppingLists[type].find(i => i.id === itemId);
    if (!item) return;

    const newName = prompt('Nome do item:', item.name);
    if (newName === null) return;
    const newQty = prompt('Quantidade:', item.qty);
    if (newQty === null) return;
    const newPrice = prompt('Preço (R$):', item.price);
    if (newPrice === null) return;

    if (newName.trim()) item.name = newName.trim();
    if (newQty && !isNaN(parseInt(newQty))) item.qty = parseInt(newQty);
    if (newPrice && !isNaN(parseFloat(newPrice))) item.price = parseFloat(newPrice);
    
    this.renderShoppingList();
    
    try {
      await db.upsertShoppingItem(type, item);
    } catch (error) {
      logger.error('Erro ao editar item de compra', error);
      alert('❌ Erro ao editar no banco de dados.');
    }
  }, 500),

  // ===== CALENDAR FUNCTIONS =====

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
        <button onclick="app.previousMonth()" class="btn btn--secondary btn--sm">←</button>
        <h3>${monthNames[month]} ${year}</h3>
        <button onclick="app.nextMonth()" class="btn btn--secondary btn--sm">→</button>
      </div>
      <div class="calendar-grid">
        ${dayNames.map(day => `<div class="calendar-day-name">${day}</div>`).join('')}
    `;

    for (let i = 0; i < startingDayOfWeek; i++) {
      html += '<div class="calendar-cell empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const tasksOnDay = this.state.tasks.filter(t => t.date === dateStr);
      const isToday = this.isToday(currentDate);

      html += `
        <div class="calendar-cell ${isToday ? 'today' : ''}">
          <div class="calendar-date">${day}</div>
          ${tasksOnDay.length > 0 ? `<div class="calendar-tasks">${tasksOnDay.length}</div>` : ''}
        </div>
      `;
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
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    let html = `
      <div class="calendar-header">
        <button onclick="app.previousWeek()" class="btn btn--secondary btn--sm">←</button>
        <h3>Semana de ${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]}</h3>
        <button onclick="app.nextWeek()" class="btn btn--secondary btn--sm">→</button>
      </div>
      <div class="week-view">
    `;

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const day = currentDate.getDate();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const tasksOnDay = this.state.tasks.filter(t => t.date === dateStr);
      const isToday = this.isToday(currentDate);

      html += `
        <div class="week-day ${isToday ? 'today' : ''}">
          <div class="week-day-header">
            <div class="week-day-name">${dayNames[i]}</div>
            <div class="week-day-date">${day}</div>
          </div>
          <div class="week-day-tasks">
      `;

      tasksOnDay.forEach(task => {
        const priorityClass = task.priority || 'normal';
        html += `
          <div class="week-task week-task--${priorityClass}" onclick="app.editTask('${task.id}')">
            <div class="week-task-time">${task.time || '--:--'}</div>
            <div class="week-task-title">${task.title || task.name}</div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
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

  // ===== RENDER FUNCTIONS =====

  renderTasksDashboard() {
    const urgentContainer = document.getElementById('urgentTasks');
    const todayContainer = document.getElementById('todayTasks');
    const upcomingExamsContainer = document.getElementById('upcomingExams');

    if (!urgentContainer || !todayContainer || !upcomingExamsContainer) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const urgentTasks = this.state.tasks.filter(t => 
      t.priority === 'urgente' && t.status !== 'concluida'
    );
    
    const todayTasks = this.state.tasks.filter(t => 
      t.date === todayStr && t.status !== 'concluida'
    );
    
    const upcomingExams = this.state.exams
      .filter(e => {
        const examDate = this.parseLocalDate(e.date);
        return examDate >= today;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);

    this.renderTaskList(urgentContainer, urgentTasks, 'urgente');
    this.renderTaskList(todayContainer, todayTasks, 'hoje');
    this.renderExamList(upcomingExamsContainer, upcomingExams);
  },

  renderTaskList(container, tasks, status) {
    if (!tasks || tasks.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhuma tarefa</p>';
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
        <div class="task-item ${isOverdue ? 'task-item--overdue' : ''}" onclick="app.editTask('${task.id}')">
          <div class="task-item-header">
            <span class="task-priority">${priorityIcons[task.priority] || '🟡'}</span>
            <span class="task-title">${task.title || task.name}</span>
          </div>
          <div class="task-item-meta">
            <span class="task-date">${formattedDate}</span>
            ${task.time ? `<span class="task-time">${task.time}</span>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderExamList(container, exams) {
    if (!exams || exams.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhum exame próximo</p>';
      return;
    }

    let html = '';
    exams.forEach(exam => {
      const formattedDate = this.formatDateStr(exam.date);
      html += `
        <div class="exam-item" onclick="app.editExam('${exam.id}')">
          <div class="exam-item-header">
            <span class="exam-type">${exam.type}</span>
          </div>
          <div class="exam-item-meta">
            <span class="exam-date">${formattedDate}</span>
            ${exam.time ? `<span class="exam-time">${exam.time}</span>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderTasks() {
    const container = document.getElementById('tasksList');
    if (!container) return;

    const filterStatus = document.getElementById('taskFilterStatus').value;
    const filterPriority = document.getElementById('taskFilterPriority').value;

    let filteredTasks = this.state.tasks;

    if (filterStatus !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.status === filterStatus);
    }

    if (filterPriority !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.priority === filterPriority);
    }

    if (filteredTasks.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhuma tarefa encontrada.</p>';
      return;
    }

    const priorityIcons = {
      urgente: '🔴',
      normal: '🟡',
      baixa: '🟢'
    };

    let html = '';
    filteredTasks.forEach(task => {
      const formattedDate = this.formatDateStr(task.date);
      html += `
        <div class="task-card">
          <div class="task-card-header">
            <span class="task-priority">${priorityIcons[task.priority] || '🟡'}</span>
            <h3 class="task-card-title">${task.title || task.name}</h3>
          </div>
          ${task.description ? `<p class="task-card-description">${task.description}</p>` : ''}
          <div class="task-card-meta">
            <span>📅 ${formattedDate}</span>
            ${task.time ? `<span>🕒 ${task.time}</span>` : ''}
            <span class="task-status task-status--${task.status}">${this.getStatusLabel(task.status)}</span>
          </div>
          <div class="task-card-actions">
            <button onclick="app.editTask('${task.id}')" class="btn btn--secondary btn--sm">Editar</button>
            <button onclick="app.deleteTask('${task.id}')" class="btn btn--danger btn--sm">Excluir</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderShoppingList() {
    const container = document.getElementById('shoppingListItems');
    const totalElement = document.getElementById('shoppingTotal');
    
    if (!container || !totalElement) return;

    const items = this.state.shoppingLists[this.state.currentShoppingList];

    if (!items || items.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhum item adicionado.</p>';
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
        <div class="shopping-item ${item.purchased ? 'shopping-item--purchased' : ''}">
          <div class="shopping-item-checkbox">
            <input type="checkbox" ${item.purchased ? 'checked' : ''} 
                   onchange="app.toggleShoppingItem('${item.id}')">
          </div>
          <div class="shopping-item-content">
            <div class="shopping-item-name">${item.name}</div>
            <div class="shopping-item-meta">
              Qtd: ${item.qty} | R$ ${item.price.toFixed(2)} | Total: R$ ${itemTotal.toFixed(2)}
            </div>
          </div>
          <div class="shopping-item-actions">
            <button onclick="app.editShoppingItem('${this.state.currentShoppingList}', '${item.id}')" 
                    class="btn btn--secondary btn--sm">✏️</button>
            <button onclick="app.deleteShoppingItem('${item.id}')" 
                    class="btn btn--danger btn--sm">🗑️</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    totalElement.textContent = total.toFixed(2);
  },

  renderExams() {
    const container = document.getElementById('examsList');
    if (!container) return;

    if (this.state.exams.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhum exame cadastrado.</p>';
      return;
    }

    let html = '';
    this.state.exams.forEach(exam => {
      const formattedDate = this.formatDateStr(exam.date);
      html += `
        <div class="exam-card">
          <div class="exam-card-header">
            <h3 class="exam-card-title">${exam.type}</h3>
          </div>
          ${exam.notes ? `<p class="exam-card-notes">${exam.notes}</p>` : ''}
          <div class="exam-card-meta">
            <span>📅 ${formattedDate}</span>
            ${exam.time ? `<span>🕒 ${exam.time}</span>` : ''}
            ${exam.location ? `<span>📍 ${exam.location}</span>` : ''}
          </div>
          <div class="exam-card-actions">
            <button onclick="app.editExam('${exam.id}')" class="btn btn--secondary btn--sm">Editar</button>
            <button onclick="app.deleteExam('${exam.id}')" class="btn btn--danger btn--sm">Excluir</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderProjects() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    if (this.state.projects.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhum projeto criado.</p>';
      return;
    }

    let html = '';
    this.state.projects.forEach(project => {
      const totalTime = project.tasks.reduce((sum, task) => {
        let time = task.timeSpent;
        if (task.isRunning) {
          time += Date.now() - task.startTime;
        }
        return sum + time;
      }, 0);

      html += `
        <div class="project-card">
          <div class="project-card-header">
            <h3 class="project-card-title">${project.name}</h3>
            <span class="project-time">${this.formatTime(totalTime)}</span>
          </div>
          ${project.description ? `<p class="project-card-description">${project.description}</p>` : ''}
          
          <div class="project-tasks">
      `;

      if (project.tasks.length === 0) {
        html += '<p class="empty-state">Nenhuma tarefa adicionada.</p>';
      } else {
        project.tasks.forEach(task => {
          let currentTime = task.timeSpent;
          if (task.isRunning) {
            currentTime += Date.now() - task.startTime;
          }

          const stateEmoji = {
            'fazer': '⏸️',
            'pausada': '⏸️',
            'concluida': '✅'
          };

          html += `
            <div class="project-task ${task.state === 'concluida' ? 'project-task--completed' : ''}">
              <div class="project-task-info">
                <span class="project-task-state">${stateEmoji[task.state] || '⏸️'}</span>
                <div class="project-task-details">
                  <div class="project-task-name">${task.name}</div>
                  <div class="project-task-time">${this.formatTime(currentTime)}</div>
                </div>
              </div>
              <div class="project-task-actions">
                ${task.state !== 'concluida' ? `
                  ${task.isRunning ? `
                    <button onclick="app.pauseTimer('${project.id}', '${task.id}')" 
                            class="btn btn--secondary btn--sm">⏸️</button>
                  ` : `
                    <button onclick="app.startTimer('${project.id}', '${task.id}')" 
                            class="btn btn--primary btn--sm">▶️</button>
                  `}
                  <button onclick="app.finishTimer('${project.id}', '${task.id}')" 
                          class="btn btn--success btn--sm">✓</button>
                ` : ''}
                <button onclick="app.deleteProjectTask('${project.id}', '${task.id}')" 
                        class="btn btn--danger btn--sm">🗑️</button>
              </div>
            </div>
          `;
        });
      }

      html += `
          </div>
          
          <div class="project-card-actions">
            <button onclick="app.openNewProjectTaskModal('${project.id}')" class="btn btn--secondary btn--sm">
              + Tarefa
            </button>
            <button onclick="app.editProject('${project.id}')" class="btn btn--secondary btn--sm">
              Editar Projeto
            </button>
            <button onclick="app.deleteProject('${project.id}')" class="btn btn--danger btn--sm">
              Excluir Projeto
            </button>
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

  // ===== NOTIFICATIONS =====

  checkNotifications() {
    if (!this.state.settings.enableNotifications) return;

    const now = new Date();
    const notificationTime = this.state.settings.notificationTime;

    this.state.tasks.forEach(task => {
      if (task.alarm && task.status !== 'concluida') {
        const taskDate = this.parseLocalDate(task.date);
        let taskDateTime = new Date(taskDate);
        
        if (task.time) {
          const [hours, minutes] = task.time.split(':');
          taskDateTime.setHours(parseInt(hours), parseInt(minutes));
        }

        const timeDiff = taskDateTime - now;
        const minutesDiff = Math.floor(timeDiff / (1000 * 60));

        if (minutesDiff === notificationTime && minutesDiff >= 0) {
          if (!this.state.notified.tasks[task.id]) {
            this.showNotification('Lembrete de Tarefa', `${task.title || task.name} - ${task.time || 'Sem horário'}`);
            this.state.notified.tasks[task.id] = true;
          }
        }
      }
    });

    this.state.exams.forEach(exam => {
      const examDate = this.parseLocalDate(exam.date);
      let examDateTime = new Date(examDate);
      
      if (exam.time) {
        const [hours, minutes] = exam.time.split(':');
        examDateTime.setHours(parseInt(hours), parseInt(minutes));
      }

      const timeDiff = examDateTime - now;
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));

      if (minutesDiff === notificationTime && minutesDiff >= 0) {
        if (!this.state.notified.exams[exam.id]) {
          this.showNotification('Lembrete de Exame', `${exam.type} - ${exam.time || 'Sem horário'}`);
          this.state.notified.exams[exam.id] = true;
        }
      }
    });
  },

  showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
      if (this.state.settings.notificationSound) {
        this.playNotificationSound();
      }
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
          if (this.state.settings.notificationSound) {
            this.playNotificationSound();
          }
        }
      });
    }
  },

  playNotificationSound() {
    const audio = new Audio(`sounds/${this.state.settings.notificationSound}.mp3`);
    audio.play().catch(e => console.log('Erro ao reproduzir som:', e));
  },

  // ===== POMODORO FUNCTIONS =====

  initPomodoro() {
    const focusTimeInput = document.getElementById('pomodoroFocusTime');
    const breakTimeInput = document.getElementById('pomodoroBreakTime');

    if (focusTimeInput) {
      focusTimeInput.value = this.state.pomodoro.focusTime;
      focusTimeInput.addEventListener('change', (e) => {
        this.state.pomodoro.focusTime = parseInt(e.target.value);
        if (this.state.pomodoro.mode === 'focus' && !this.state.pomodoro.isRunning) {
          this.state.pomodoro.currentTime = this.state.pomodoro.focusTime * 60;
          this.updatePomodoroDisplay();
        }
      });
    }

    if (breakTimeInput) {
      breakTimeInput.value = this.state.pomodoro.breakTime;
      breakTimeInput.addEventListener('change', (e) => {
        this.state.pomodoro.breakTime = parseInt(e.target.value);
        if (this.state.pomodoro.mode === 'break' && !this.state.pomodoro.isRunning) {
          this.state.pomodoro.currentTime = this.state.pomodoro.breakTime * 60;
          this.updatePomodoroDisplay();
        }
      });
    }
  },

  startPomodoro() {
    if (this.state.pomodoro.isRunning) return;

    this.state.pomodoro.isRunning = true;
    this.state.pomodoro.isPaused = false;

    this.state.pomodoro.intervalId = setInterval(() => {
      if (this.state.pomodoro.currentTime > 0) {
        this.state.pomodoro.currentTime--;
        this.updatePomodoroDisplay();
      } else {
        this.pomodoroComplete();
      }
    }, 1000);

    this.updatePomodoroDisplay();
  },

  pausePomodoro() {
    if (!this.state.pomodoro.isRunning) return;

    this.state.pomodoro.isRunning = false;
    this.state.pomodoro.isPaused = true;
    clearInterval(this.state.pomodoro.intervalId);
    this.updatePomodoroDisplay();
  },

  resetPomodoro() {
    this.state.pomodoro.isRunning = false;
    this.state.pomodoro.isPaused = false;
    clearInterval(this.state.pomodoro.intervalId);

    if (this.state.pomodoro.mode === 'focus') {
      this.state.pomodoro.currentTime = this.state.pomodoro.focusTime * 60;
    } else {
      this.state.pomodoro.currentTime = this.state.pomodoro.breakTime * 60;
    }

    this.updatePomodoroDisplay();
  },

  pomodoroComplete() {
    clearInterval(this.state.pomodoro.intervalId);
    this.state.pomodoro.isRunning = false;

    if (this.state.pomodoro.audio.enabled) {
      this.playNotificationSound();
    }

    if (this.state.pomodoro.mode === 'focus') {
      alert('Tempo de foco concluído! Faça uma pausa.');
      this.state.pomodoro.mode = 'break';
      this.state.pomodoro.currentTime = this.state.pomodoro.breakTime * 60;
    } else {
      alert('Pausa concluída! Volte ao foco.');
      this.state.pomodoro.mode = 'focus';
      this.state.pomodoro.currentTime = this.state.pomodoro.focusTime * 60;
    }

    this.updatePomodoroDisplay();
  },

  updatePomodoroDisplay() {
    const timerDisplay = document.getElementById('pomodoroTimer');
    const modeDisplay = document.getElementById('pomodoroMode');
    const startBtn = document.getElementById('pomodoroStart');
    const pauseBtn = document.getElementById('pomodoroPause');

    if (!timerDisplay) return;

    const minutes = Math.floor(this.state.pomodoro.currentTime / 60);
    const seconds = this.state.pomodoro.currentTime % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (modeDisplay) {
      modeDisplay.textContent = this.state.pomodoro.mode === 'focus' ? 'Foco' : 'Pausa';
      modeDisplay.className = `pomodoro-mode pomodoro-mode--${this.state.pomodoro.mode}`;
    }

    if (startBtn && pauseBtn) {
      if (this.state.pomodoro.isRunning) {
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
      } else {
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
      }
    }
  },

  togglePomodoroAudio() {
    this.state.pomodoro.audio.enabled = !this.state.pomodoro.audio.enabled;
    const btn = document.getElementById('pomodoroAudioToggle');
    if (btn) {
      btn.textContent = this.state.pomodoro.audio.enabled ? '🔊' : '🔇';
    }
  },

  changePomodoroAudioSource(source) {
    this.state.pomodoro.audio.currentSource = source;
    if (this.state.pomodoro.audio.isPlaying) {
      this.stopAmbientSound();
      this.playAmbientSound();
    }
  },

  playAmbientSound() {
    if (this.state.pomodoro.audio.isPlaying) return;

    const audio = new Audio(`sounds/${this.state.pomodoro.audio.currentSource}.mp3`);
    audio.loop = true;
    audio.volume = this.state.pomodoro.audio.volume;
    audio.play();

    this.state.pomodoro.audio.isPlaying = true;
    this.state.pomodoro.audio.audioElement = audio;

    const btn = document.getElementById('pomodoroPlayAmbient');
    if (btn) {
      btn.textContent = '⏸️ Pausar Som Ambiente';
    }
  },

  stopAmbientSound() {
    if (!this.state.pomodoro.audio.isPlaying) return;

    const audio = this.state.pomodoro.audio.audioElement;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    this.state.pomodoro.audio.isPlaying = false;

    const btn = document.getElementById('pomodoroPlayAmbient');
    if (btn) {
      btn.textContent = '▶️ Reproduzir Som Ambiente';
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
