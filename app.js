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
        'afazer': 'pendente', 'todo': 'pendente',
        'doing': 'andamento', 'in_progress': 'andamento', 'em_andamento': 'andamento',
        'done': 'concluida', 'concluída': 'concluida', 'concluido': 'concluida'
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
      pendente: 'afazer',
      andamento: 'andamento',
      concluida: 'concluida'
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
      alarm: !!task.alarm,                     // <<< ALARM DESCOMENTADO E ENVIADO
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
      price: Number(row.price ?? 0),
      purchased: !!row.purchased,
      createdAt: row.created_at || new Date().toISOString()
    }));
  },

  async upsertShoppingItem(listType, item) {
    const payload = {
      id: String(item.id),
      list_type: listType,
      name: item.name,
      quantity: Number(item.qty),
      price: Number(item.price),
      purchased: !!item.purchased,
      updated_at: new Date().toISOString()
    };
    if (!item.createdAt) payload.created_at = new Date().toISOString();
    const { error } = await this.client.from('shopping_items').upsert(payload);
    if (error) throw error;
  },

  async deleteShoppingItem(listType, id) {
    const { error } = await this.client.from('shopping_items').delete()
      .eq('list_type', listType).eq('id', String(id));
    if (error) throw error;
  },

  // ---------- PROJECTS ----------
  async loadProjectsWithTasks() {
    const { data: projects, error: e1 } = await this.client
      .from('projects').select('*')
      .order('created_at', { ascending: true });
    if (e1) throw e1;

    const { data: tasks, error: e2 } = await this.client
      .from('project_tasks').select('*')
      .order('created_at', { ascending: true });
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
    if (!project.createdAt) payload.created_at = new Date().toISOString();
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
      time_spent: Number(task.timeSpent ?? 0),
      is_running: !!task.isRunning,
      start_time: task.startTime ? Number(task.startTime) : null,
      updated_at: new Date().toISOString()
    };
    if (!task.createdAt) payload.created_at = new Date().toISOString();
    const { error } = await this.client.from('project_tasks').upsert(payload);
    if (error) throw error;
  },

  async deleteProject(id) {
    const { error } = await this.client.from('projects').delete().eq('id', String(id));
    if (error) throw error;
  },

  async deleteProjectTask(projectId, taskId) {
    const { error } = await this.client.from('project_tasks')
      .delete().eq('project_id', String(projectId)).eq('id', String(taskId));
    if (error) throw error;
  }
};

// ---------------------------------------------------------------------
// ----------------------- UTILIDADES GLOBAIS -------------------------
function generateId() {
  return crypto.randomUUID();
}

function cacheState(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function loadCache(key) {
  const cached = localStorage.getItem(key);
  return cached ? JSON.parse(cached) : null;
}

// Wrapper DB com loading, backup e reversão
async function withDb(operation, successCb, errorCb) {
  app.state.isSaving = true;
  app.renderLoading?.();

  let backup = null;
  if (errorCb) backup = errorCb.backup?.(); // opcional

  try {
    const result = await operation();
    if (successCb) successCb(result);
    app.cacheAllStates();
  } catch (err) {
    console.error('DB Error:', err);
    if (errorCb) errorCb.revert(backup);
    alert('Erro no banco: ' + err.message + '. Alterações revertidas.');
    throw err;
  } finally {
    app.state.isSaving = false;
    app.renderLoading?.();
  }
}

// Cache de todos os estados
app.cacheAllStates = function () {
  cacheState('tasks', this.state.tasks);
  cacheState('exams', this.state.exams);
  cacheState('shopping', this.state.shoppingLists);
  cacheState('projects', this.state.projects);
};

// ---------------------------------------------------------------------
// --------------------------- APP CORE -------------------------------
const app = {
  state: {
    tasks: [],
    exams: [],
    shoppingLists: { supermercado: [], farmacia: [] },
    projects: [],
    pomodoro: { /* ... seu estado original ... */ },
    isSaving: false
  },

  async init() {
    db.init();

    // ---- CARREGAMENTO COM CACHE FALLBACK ----
    const loadWithCache = async (loader, cacheKey, fallback) => {
      try {
        const data = await loader();
        cacheState(cacheKey, data);
        return data;
      } catch (e) {
        const cached = loadCache(cacheKey);
        if (cached) {
          alert('Offline: usando cache local para ' + cacheKey);
          return cached;
        }
        return fallback;
      }
    };

    this.state.tasks = await loadWithCache(db.loadTasks.bind(db), 'tasks', []);
    this.state.exams = await loadWithCache(db.loadExams.bind(db), 'exams', []);
    this.state.shoppingLists.supermercado = await loadWithCache(
      () => db.loadShopping('supermercado'), 'shopping', { supermercado: [], farmacia: [] }).supermercado;
    this.state.shoppingLists.farmacia = await loadWithCache(
      () => db.loadShopping('farmacia'), 'shopping', { supermercado: [], farmacia: [] }).farmacia;
    this.state.projects = await loadWithCache(db.loadProjectsWithTasks.bind(db), 'projects', []);

    // Resto da inicialização original (renders, timers, etc.)
    this.renderAll();
    this.startPomodoroInterval?.();
    setInterval(() => this.checkAlarms?.(), 60000);
  },

  // -----------------------------------------------------------------
  // ------------------------- TASKS ---------------------------------
  async addQuickTask() {
    const title = document.getElementById('quickTaskTitle')?.value.trim();
    if (!title) return alert('Título é obrigatório.');

    const task = {
      id: generateId(),
      title,
      description: '',
      date: '',
      time: '',
      priority: 'normal',
      status: 'pendente',
      alarm: false,
      createdAt: new Date().toISOString()
    };

    await withDb(
      () => db.upsertTask(task),
      () => {
        this.state.tasks = [...this.state.tasks, task];
        this.renderTasksView?.();
      }
    );
  },

  async saveTask() {
    const title = document.getElementById('taskTitle')?.value.trim();
    if (!title) return alert('Título é obrigatório.');

    const task = {
      id: this.state.editingTask ? this.state.editingTask.id : generateId(),
      title,
      description: document.getElementById('taskDescription')?.value || '',
      date: document.getElementById('taskDate')?.value || '',
      time: document.getElementById('taskTime')?.value || '',
      priority: document.getElementById('taskPriority')?.value || 'normal',
      status: this.state.editingTask?.status || 'pendente',
      alarm: !!document.getElementById('alarmCheckbox')?.checked,
      createdAt: this.state.editingTask?.createdAt || new Date().toISOString()
    };

    await withDb(
      () => db.upsertTask(task),
      () => {
        const idx = this.state.tasks.findIndex(t => t.id === task.id);
        const newTasks = idx >= 0
          ? this.state.tasks.map((t, i) => i === idx ? task : t)
          : [...this.state.tasks, task];
        this.state.tasks = newTasks;
        this.closeTaskModal?.();
        this.renderTasksView?.();
      }
    );
  },

  async deleteTask(id) {
    const idx = this.state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    const backup = [...this.state.tasks];
    this.state.tasks = this.state.tasks.filter(t => t.id !== id);
    this.renderTasksView?.();

    await withDb(
      () => db.deleteTask(id),
      null,
      { revert: () => { this.state.tasks = backup; this.renderTasksView?.(); } }
    );
  },

  // -----------------------------------------------------------------
  // -------------------------- EXAMS --------------------------------
  async saveExam() {
    const type = document.getElementById('examType')?.value.trim();
    const date = document.getElementById('examDate')?.value;
    if (!type || !date) return alert('Tipo e data são obrigatórios.');

    const exam = {
      id: this.state.editingExam ? this.state.editingExam.id : generateId(),
      type,
      date,
      time: document.getElementById('examTime')?.value || '',
      location: document.getElementById('examLocation')?.value || '',
      notes: document.getElementById('examNotes')?.value || '',
      fileName: this.state.editingExam?.fileName || null
    };

    await withDb(
      () => db.upsertExam(exam),
      () => {
        const idx = this.state.exams.findIndex(e => e.id === exam.id);
        const newExams = idx >= 0
          ? this.state.exams.map((e, i) => i === idx ? exam : e)
          : [...this.state.exams, exam];
        this.state.exams = newExams;
        this.closeExamModal?.();
        this.renderExams?.();
      }
    );
  },

  async deleteExam(id) {
    const idx = this.state.exams.findIndex(e => e.id === id);
    if (idx === -1) return;
    const backup = [...this.state.exams];
    this.state.exams = this.state.exams.filter(e => e.id !== id);
    this.renderExams?.();

    await withDb(
      () => db.deleteExam(id),
      null,
      { revert: () => { this.state.exams = backup; this.renderExams?.(); } }
    );
  },

  // -----------------------------------------------------------------
  // -------------------------- SHOPPING -----------------------------
  async addShoppingItem(type) {
    const nameInput = document.getElementById(`${type === 'supermercado' ? 'super' : 'farm'}-item`);
    const qtyInput = document.getElementById(`${type === 'supermercado' ? 'super' : 'farm'}-qty`);
    const priceInput = document.getElementById(`${type === 'supermercado' ? 'super' : 'farm'}-price`);

    const name = nameInput?.value.trim();
    const qty = parseInt(qtyInput?.value) || 1;
    const price = parseFloat(priceInput?.value) || 0;
    if (!name) return alert('Nome do item é obrigatório.');

    const item = {
      id: generateId(),
      name,
      qty,
      price,
      purchased: false,
      createdAt: new Date().toISOString()
    };

    await withDb(
      () => db.upsertShoppingItem(type, item),
      () => {
        this.state.shoppingLists[type] = [...this.state.shoppingLists[type], item];
        nameInput.value = ''; qtyInput.value = '1'; priceInput.value = '';
        this.renderShoppingList?.();
      }
    );
  },

  async togglePurchased(type, itemId) {
    const list = this.state.shoppingLists[type];
    const idx = list.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    const backup = [...list];
    const newItem = { ...list[idx], purchased: !list[idx].purchased };
    list[idx] = newItem;

    await withDb(
      () => db.upsertShoppingItem(type, newItem),
      () => this.renderShoppingList?.(),
      { revert: () => { this.state.shoppingLists[type] = backup; this.renderShoppingList?.(); } }
    );
  },

  async deleteShoppingItem(type, id) {
    const list = this.state.shoppingLists[type];
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return;
    const backup = [...list];
    this.state.shoppingLists[type] = list.filter(i => i.id !== id);
    this.renderShoppingList?.();

    await withDb(
      () => db.deleteShoppingItem(type, id),
      null,
      { revert: () => { this.state.shoppingLists[type] = backup; this.renderShoppingList?.(); } }
    );
  },

  // -----------------------------------------------------------------
  // -------------------------- PROJECTS -----------------------------
  async saveProject() {
    const name = document.getElementById('projectName')?.value.trim();
    if (!name) return alert('Nome do projeto é obrigatório.');

    const project = {
      id: this.state.editingProject ? this.state.editingProject.id : generateId(),
      name,
      description: document.getElementById('projectDescription')?.value || '',
      tasks: this.state.editingProject?.tasks || [],
      createdAt: this.state.editingProject?.createdAt || new Date().toISOString()
    };

    await withDb(
      () => db.upsertProject(project),
      () => {
        const idx = this.state.projects.findIndex(p => p.id === project.id);
        const newProjects = idx >= 0
          ? this.state.projects.map((p, i) => i === idx ? project : p)
          : [...this.state.projects, project];
        this.state.projects = newProjects;
        this.closeProjectModal?.();
        this.renderProjects?.();
      }
    );
  },

  async saveProjectTask() {
    const name = document.getElementById('projectTaskName')?.value.trim();
    if (!name) return alert('Nome da tarefa é obrigatório.');

    const project = this.state.projects.find(p => p.id === this.state.currentProjectId);
    if (!project) return;

    const task = {
      id: this.state.editingProjectTask ? this.state.editingProjectTask.id : generateId(),
      name,
      description: document.getElementById('projectTaskDescription')?.value || '',
      state: document.getElementById('projectTaskState')?.value || 'fazer',
      timeSpent: this.state.editingProjectTask?.timeSpent || 0,
      isRunning: false,
      startTime: null,
      createdAt: this.state.editingProjectTask?.createdAt || new Date().toISOString()
    };

    // Primeiro salva o projeto (FK)
    await withDb(
      () => db.upsertProject(project).then(() => db.upsertProjectTask(this.state.currentProjectId, task)),
      () => {
        const pIdx = this.state.projects.findIndex(p => p.id === project.id);
        const newProj = { ...project };
        const tIdx = newProj.tasks.findIndex(t => t.id === task.id);
        if (tIdx >= 0) newProj.tasks[tIdx] = task;
        else newProj.tasks = [...newProj.tasks, task];

        const newProjects = this.state.projects.map((p, i) => i === pIdx ? newProj : p);
        this.state.projects = newProjects;
        this.closeProjectTaskModal?.();
        this.renderProjects?.();
      }
    );
  },

  async deleteProject(id) {
    const idx = this.state.projects.findIndex(p => p.id === id);
    if (idx === -1) return;
    const backup = [...this.state.projects];
    this.state.projects = this.state.projects.filter(p => p.id !== id);
    this.renderProjects?.();

    await withDb(
      () => db.deleteProject(id),
      null,
      { revert: () => { this.state.projects = backup; this.renderProjects?.(); } }
    );
  },

  async deleteProjectTask(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    const backup = { ...project, tasks: [...project.tasks] };
    project.tasks = project.tasks.filter(t => t.id !== taskId);
    this.renderProjects?.();

    await withDb(
      () => db.deleteProjectTask(projectId, taskId),
      null,
      { revert: () => {
        const pIdx = this.state.projects.findIndex(p => p.id === projectId);
        this.state.projects[pIdx] = backup;
        this.renderProjects?.();
      } }
    );
  },

  // -----------------------------------------------------------------
  // ---------------------- POMODORO (mantido) -----------------------
  // (seu código original do pomodoro permanece aqui – sem alterações)
  // ... (todo o bloco pomodoro que já estava no documento) ...

  // -----------------------------------------------------------------
  // ---------------------- RENDER & UI HELPERS ----------------------
  renderLoading() {
    const el = document.getElementById('global-loading');
    if (el) el.style.display = this.state.isSaving ? 'flex' : 'none';
  },

  renderAll() {
    this.renderTasksView?.();
    this.renderExams?.();
    this.renderShoppingList?.();
    this.renderProjects?.();
    this.renderTasksDashboard?.();
    this.renderLoading?.();
  }
};

// ---------------------------------------------------------------------
// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}
