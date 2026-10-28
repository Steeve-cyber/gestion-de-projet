'use strict';

// Atelier — un espace de projet léger, rapide et sauvegardé sur l'appareil.
const STORAGE_KEY = 'atelier-projects-tasks-v2';
const LEGACY_STORAGE_KEY = 'tasks';
const STATUSES = ['À faire', 'En cours', 'Terminée'];
const PRIORITIES = { high: 'Haute', medium: 'Normale', low: 'Basse' };
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PROJECTS = [
  { id: 'maison-sepia', name: 'Maison Sépia', type: 'Identité de marque', tone: 'terracotta', initials: 'MS' },
  { id: 'atelier-nomade', name: 'Atelier Nomade', type: 'Site e-commerce', tone: 'sage', initials: 'AN' },
  { id: 'journal-serein', name: 'Journal Serein', type: 'Édition & contenu', tone: 'lilac', initials: 'JS' }
];
const ICON_PATHS = {
  check: '<path d="m5 12 4 4L19 6"/>',
  edit: '<path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};

const today = new Date();
const dateAtOffset = (offset) => {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
const createId = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

function makeDemoTasks() {
  return [
    { id: createId(), name: 'Définir le territoire de marque', status: 'Terminée', deadline: dateAtOffset(-2), priority: 'high', project: 'maison-sepia', notes: 'Direction créative validée avec le client.' },
    { id: createId(), name: 'Finaliser le moodboard éditorial', status: 'En cours', deadline: dateAtOffset(1), priority: 'high', project: 'maison-sepia', notes: 'Préparer deux pistes colorimétriques.' },
    { id: createId(), name: 'Décliner le logo sur les supports', status: 'À faire', deadline: dateAtOffset(4), priority: 'medium', project: 'maison-sepia', notes: '' },
    { id: createId(), name: 'Intégrer la page d’accueil', status: 'En cours', deadline: dateAtOffset(2), priority: 'high', project: 'atelier-nomade', notes: 'Vérifier les versions tablette et mobile.' },
    { id: createId(), name: 'Optimiser les visuels produits', status: 'À faire', deadline: dateAtOffset(6), priority: 'low', project: 'atelier-nomade', notes: '' },
    { id: createId(), name: 'Rédiger le manifeste de la marque', status: 'Terminée', deadline: dateAtOffset(-1), priority: 'medium', project: 'atelier-nomade', notes: '' },
    { id: createId(), name: 'Valider la ligne éditoriale', status: 'En cours', deadline: dateAtOffset(0), priority: 'medium', project: 'journal-serein', notes: 'Partager le document avec Camille.' },
    { id: createId(), name: 'Préparer le calendrier de novembre', status: 'À faire', deadline: dateAtOffset(5), priority: 'low', project: 'journal-serein', notes: '' }
  ];
}

function normalizeTask(item) {
  if (!item || typeof item !== 'object' || !String(item.name || '').trim()) return null;
  const rawStatus = String(item.status || '').trim().toLowerCase();
  const status = STATUSES.find((candidate) => candidate.toLowerCase() === rawStatus) || 'À faire';
  return {
    id: item.id || createId(),
    name: String(item.name).trim().slice(0, 100),
    status,
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(item.deadline || '') ? item.deadline : '',
    priority: Object.prototype.hasOwnProperty.call(PRIORITIES, item.priority) ? item.priority : 'medium',
    project: PROJECTS.some((project) => project.id === item.project) ? item.project : PROJECTS[0].id,
    notes: String(item.notes || '').slice(0, 300),
    createdAt: Number(item.createdAt) || (typeof item.id === 'number' ? item.id : Date.now())
  };
}

function readInitialTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.map(normalizeTask).filter(Boolean) : [];
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
    if (Array.isArray(legacy) && legacy.length) {
      return legacy.map((item) => normalizeTask({ ...item, project: PROJECTS[0].id })).filter(Boolean);
    }
  } catch (error) {
    console.warn('Les tâches enregistrées n’ont pas pu être lues.', error);
  }
  return makeDemoTasks().map(normalizeTask).filter(Boolean);
}

let tasks = readInitialTasks();
let activeFilter = 'all';
let activeProject = null;
let activeSort = 'deadline';
let editingId = null;
let previousFocus = null;
let toastTimer = null;
let undoTimer = null;
let undoTask = null;
let storageWarningShown = false;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const taskForm = $('#task-form');
const modal = $('#task-modal');
const board = $('#task-board');
const searchInput = $('#task-search');

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.warn('La sauvegarde locale est indisponible.', error);
    if (!storageWarningShown) {
      showToast('La sauvegarde locale est indisponible sur cet appareil.');
      storageWarningShown = true;
    }
  }
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICON_PATHS[name] || '';
  return svg;
}

function projectFor(id) {
  return PROJECTS.find((project) => project.id === id) || PROJECTS[0];
}

function dateOnly(value) {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function dayDifference(value) {
  const date = dateOnly(value);
  if (!date) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date.getTime() - start.getTime()) / 86400000);
}

function formatDate(value, relative = false) {
  const date = dateOnly(value);
  if (!date) return 'Sans échéance';
  if (relative) {
    const difference = dayDifference(value);
    if (difference === 0) return 'Aujourd’hui';
    if (difference === 1) return 'Demain';
    if (difference === -1) return 'Hier';
    if (difference < -1) return 'En retard de ' + Math.abs(difference) + ' j';
    if (difference < 7) return 'Dans ' + difference + ' j';
  }
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

function setCurrentDate() {
  const date = new Date();
  const fullDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  const capitalized = fullDate.charAt(0).toLocaleUpperCase('fr-FR') + fullDate.slice(1);
  $('#welcome-date').textContent = capitalized;
  $('#today-label').textContent = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(date);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function createButton(className, label, iconName) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(icon(iconName));
  return button;
}

function renderProjectNavigation() {
  const projectNav = $('#project-nav');
  const projectSelect = $('#task-project');
  projectNav.replaceChildren();
  projectSelect.replaceChildren();

  PROJECTS.forEach((project) => {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'project-nav-item' + (activeProject === project.id ? ' is-active' : '');
    link.dataset.project = project.id;
    const mark = document.createElement('span');
    mark.className = 'project-nav-mark tone-' + project.tone;
    mark.textContent = project.initials.slice(0, 1);
    const title = document.createElement('span');
    title.textContent = project.name;
    const count = document.createElement('small');
    count.textContent = String(tasks.filter((task) => task.project === project.id && task.status !== 'Terminée').length);
    link.append(mark, title, count);
    projectNav.append(link);

    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    projectSelect.append(option);
  });
  setText('nav-project-count', String(PROJECTS.length).padStart(2, '0'));
}

function getVisibleTasks() {
  const query = searchInput.value.trim().toLocaleLowerCase('fr-FR');
  let result = tasks.filter((task) => {
    const matchesFilter = activeFilter === 'all' || task.status === activeFilter;
    const matchesProject = !activeProject || task.project === activeProject;
    const project = projectFor(task.project);
    const matchesQuery = !query || (task.name + ' ' + project.name + ' ' + task.notes).toLocaleLowerCase('fr-FR').includes(query);
    return matchesFilter && matchesProject && matchesQuery;
  });
  result = result.slice();
  if (activeSort === 'priority') {
    result.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (dayDifference(a.deadline) ?? 999) - (dayDifference(b.deadline) ?? 999));
  } else if (activeSort === 'recent') {
    result.sort((a, b) => b.createdAt - a.createdAt);
  } else {
    result.sort((a, b) => (dayDifference(a.deadline) ?? 999) - (dayDifference(b.deadline) ?? 999));
  }
  return result;
}

function makeTaskCard(task) {
  const project = projectFor(task.project);
  const card = document.createElement('article');
  card.className = 'task-card' + (task.status === 'Terminée' ? ' is-complete' : '');
  card.dataset.id = task.id;

  const top = document.createElement('div');
  top.className = 'task-card-top';
  const priority = document.createElement('span');
  priority.className = 'priority-badge priority-' + task.priority;
  const priorityMark = document.createElement('i');
  priorityMark.setAttribute('aria-hidden', 'true');
  priority.append(priorityMark, document.createTextNode(PRIORITIES[task.priority]));
  top.append(priority);
  const actions = document.createElement('div');
  actions.className = 'task-actions';
  actions.append(createButton('task-icon-button task-edit', 'Modifier « ' + task.name + ' »', 'edit'));
  actions.append(createButton('task-icon-button task-delete', 'Supprimer « ' + task.name + ' »', 'trash'));
  top.append(actions);

  const title = document.createElement('h4');
  title.className = 'task-title';
  title.textContent = task.name;
  card.append(top, title);
  if (task.notes) {
    const notes = document.createElement('p');
    notes.className = 'task-notes';
    notes.textContent = task.notes;
    card.append(notes);
  }

  const meta = document.createElement('div');
  meta.className = 'task-meta';
  const projectTag = document.createElement('span');
  projectTag.className = 'task-project tone-' + project.tone;
  const projectDot = document.createElement('i');
  projectDot.setAttribute('aria-hidden', 'true');
  projectTag.append(projectDot, document.createTextNode(project.name));
  const deadline = document.createElement('span');
  deadline.className = 'task-deadline' + (task.status !== 'Terminée' && dayDifference(task.deadline) !== null && dayDifference(task.deadline) < 0 ? ' is-overdue' : '');
  deadline.append(icon('calendar'), document.createTextNode(formatDate(task.deadline, true)));
  meta.append(projectTag, deadline);
  card.append(meta);

  const status = document.createElement('select');
  status.className = 'task-status-select status-' + (task.status === 'Terminée' ? 'done' : task.status === 'En cours' ? 'progress' : 'todo');
  status.setAttribute('aria-label', 'Statut de « ' + task.name + ' »');
  status.dataset.statusFor = task.id;
  STATUSES.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = value === task.status;
    status.append(option);
  });
  card.append(status);
  return card;
}

function renderBoard() {
  board.replaceChildren();
  const visible = getVisibleTasks();
  const columns = [
    { status: 'À faire', className: 'column-todo', title: 'À faire' },
    { status: 'En cours', className: 'column-progress', title: 'En cours' },
    { status: 'Terminée', className: 'column-done', title: 'Terminées' }
  ];

  columns.forEach((column) => {
    const items = visible.filter((task) => task.status === column.status);
    const section = document.createElement('section');
    section.className = 'board-column ' + column.className;
    const heading = document.createElement('div');
    heading.className = 'column-heading';
    const title = document.createElement('h3');
    const statusDot = document.createElement('i');
    statusDot.className = 'column-dot';
    statusDot.setAttribute('aria-hidden', 'true');
    title.append(statusDot, document.createTextNode(column.title));
    const count = document.createElement('span');
    count.className = 'column-count';
    count.textContent = String(items.length).padStart(2, '0');
    heading.append(title, count);
    const list = document.createElement('div');
    list.className = 'column-cards';
    if (items.length) {
      items.forEach((task) => list.append(makeTaskCard(task)));
    } else {
      const empty = document.createElement('p');
      empty.className = 'empty-column';
      empty.textContent = activeFilter !== 'all' || activeProject || searchInput.value.trim() ? 'Aucun résultat ici.' : 'La place est libre pour la suite.';
      list.append(empty);
    }
    section.append(heading, list);
    board.append(section);
  });
}

function renderProjects() {
  const container = $('#project-cards');
  container.replaceChildren();
  PROJECTS.forEach((project, index) => {
    const projectTasks = tasks.filter((task) => task.project === project.id);
    const completed = projectTasks.filter((task) => task.status === 'Terminée').length;
    const progress = projectTasks.length ? Math.round(completed / projectTasks.length * 100) : 0;
    const card = document.createElement('article');
    card.className = 'project-card project-' + project.tone + (activeProject === project.id ? ' is-selected' : '');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Afficher les tâches du projet ' + project.name);
    card.dataset.project = project.id;
    const art = document.createElement('div');
    art.className = 'project-art';
    const orb = document.createElement('span');
    orb.className = 'project-art-orb';
    orb.textContent = project.initials;
    const artLine = document.createElement('span');
    artLine.className = 'project-art-line';
    art.append(orb, artLine);
    const info = document.createElement('div');
    info.className = 'project-info';
    const type = document.createElement('p');
    type.className = 'project-type';
    type.textContent = project.type;
    const name = document.createElement('h3');
    name.textContent = project.name;
    info.append(type, name);
    const foot = document.createElement('div');
    foot.className = 'project-progress-label';
    const progressText = document.createElement('span');
    progressText.textContent = progress + ' % terminé';
    const taskCount = document.createElement('span');
    taskCount.textContent = projectTasks.length + (projectTasks.length > 1 ? ' tâches' : ' tâche');
    foot.append(progressText, taskCount);
    const track = document.createElement('div');
    track.className = 'project-progress-track';
    const fill = document.createElement('i');
    fill.style.width = progress + '%';
    track.append(fill);
    card.append(art, info, foot, track);
    card.style.setProperty('--project-index', index);
    container.append(card);
  });
}

function renderUpcoming() {
  const list = $('#upcoming-list');
  list.replaceChildren();
  const upcoming = tasks.filter((task) => task.status !== 'Terminée' && dayDifference(task.deadline) !== null && dayDifference(task.deadline) >= 0 && dayDifference(task.deadline) <= 7).sort((a, b) => dayDifference(a.deadline) - dayDifference(b.deadline));
  if (!upcoming.length) {
    const empty = document.createElement('p');
    empty.className = 'upcoming-empty';
    empty.textContent = 'Aucune échéance proche. Vous pouvez avancer à votre rythme.';
    list.append(empty);
    return;
  }
  upcoming.slice(0, 5).forEach((task) => {
    const row = document.createElement('div');
    row.className = 'upcoming-row';
    const date = document.createElement('span');
    date.className = 'upcoming-date' + (dayDifference(task.deadline) < 0 ? ' is-overdue' : '');
    date.append(icon('calendar'), document.createTextNode(formatDate(task.deadline, true)));
    const name = document.createElement('strong');
    name.textContent = task.name;
    const project = document.createElement('span');
    project.className = 'upcoming-project';
    project.textContent = projectFor(task.project).name;
    row.append(date, name, project);
    list.append(row);
  });
}

function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'Terminée').length;
  const open = total - completed;
  const progress = total ? Math.round(completed / total * 100) : 0;
  const upcoming = tasks.filter((task) => task.status !== 'Terminée' && dayDifference(task.deadline) !== null && dayDifference(task.deadline) >= 0 && dayDifference(task.deadline) <= 7).length;
  setText('stat-open', String(open).padStart(2, '0'));
  setText('stat-done', String(completed).padStart(2, '0'));
  setText('stat-done-rate', progress + ' %');
  setText('stat-upcoming', String(upcoming).padStart(2, '0'));
  const activeProjects = PROJECTS.filter((project) => tasks.some((task) => task.project === project.id && task.status !== 'Terminée')).length;
  setText('stat-projects', String(activeProjects).padStart(2, '0'));
  setText('hero-progress-value', progress + '%');
  setText('hero-progress-label', completed + (completed > 1 ? ' tâches terminées' : ' tâche terminée') + ' sur ' + total);
  $('#hero-progress-bar').style.width = progress + '%';
  setText('weekly-message', total ? completed === total ? 'Bravo, toutes vos tâches sont terminées. Profitez de votre élan.' : 'Vous avez déjà terminé ' + completed + (completed > 1 ? ' tâches. Chaque étape compte.' : ' tâche. Chaque étape compte.') : 'Ajoutez une tâche pour commencer à faire avancer vos idées.');
  setText('nav-task-count', String(open));
  setText('filter-count-all', String(total));
  setText('filter-count-todo', String(tasks.filter((task) => task.status === 'À faire').length));
  setText('filter-count-progress', String(tasks.filter((task) => task.status === 'En cours').length));
  setText('filter-count-done', String(completed));
}

function render() {
  renderStats();
  renderProjectNavigation();
  renderProjects();
  renderBoard();
  renderUpcoming();
  saveTasks();
}

function openModal(task = null) {
  previousFocus = document.activeElement;
  editingId = task ? task.id : null;
  $('#modal-title').textContent = task ? 'Modifier la tâche' : 'Nouvelle tâche';
  $('#modal-description').textContent = task ? 'Mettez à jour les détails de cette étape.' : 'Une idée, une étape, un projet qui avance.';
  $('#task-name').value = task ? task.name : '';
  $('#task-project').value = task ? task.project : activeProject || PROJECTS[0].id;
  $('#task-status').value = task ? task.status : 'À faire';
  $('#task-priority').value = task ? task.priority : 'medium';
  $('#task-deadline').value = task ? task.deadline : '';
  $('#task-notes').value = task ? task.notes : '';
  const submit = $('#submit-btn');
  submit.querySelector('span').textContent = task ? 'Enregistrer' : 'Ajouter la tâche';
  submit.querySelector('use').setAttribute('href', task ? '#icon-check' : '#icon-plus');
  modal.hidden = false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => $('#task-name').focus());
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
}

function showToast(message, undo = false) {
  const toast = $('#toast');
  toast.replaceChildren();
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(text);
  if (undo) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-undo';
    button.textContent = 'Annuler';
    button.addEventListener('click', restoreDeletedTask, { once: true });
    toast.append(button);
  }
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4500);
}

function restoreDeletedTask() {
  if (!undoTask) return;
  tasks.splice(Math.min(undoTask.index, tasks.length), 0, undoTask.task);
  undoTask = null;
  window.clearTimeout(undoTimer);
  $('#toast').classList.remove('is-visible');
  render();
  showToast('Tâche restaurée.');
}

function deleteTask(id) {
  const index = tasks.findIndex((task) => String(task.id) === String(id));
  if (index < 0) return;
  const [deleted] = tasks.splice(index, 1);
  undoTask = { task: deleted, index };
  window.clearTimeout(undoTimer);
  undoTimer = window.setTimeout(() => { undoTask = null; }, 5000);
  render();
  showToast('Tâche supprimée.', true);
}

function setActiveFilter(filter) {
  activeFilter = filter;
  $$('.filter-tab').forEach((button) => {
    const selected = button.dataset.filter === filter;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  renderBoard();
}

function closeSidebar() {
  $('#sidebar').classList.remove('is-open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sidebar-open');
}

function bindEvents() {
  $('[data-open-task]').forEach((button) => button.addEventListener('click', () => openModal()));

  $$('.dialog-close, [data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });

  taskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!taskForm.reportValidity()) return;
    const values = {
      name: $('#task-name').value.trim(),
      project: $('#task-project').value,
      status: $('#task-status').value,
      priority: $('#task-priority').value,
      deadline: $('#task-deadline').value,
      notes: $('#task-notes').value.trim()
    };
    if (!values.name) return;
    if (editingId !== null) {
      tasks = tasks.map((task) => String(task.id) === String(editingId) ? { ...task, ...values } : task);
      closeModal();
      render();
      showToast('Modifications enregistrées.');
    } else {
      tasks.unshift({ id: createId(), createdAt: Date.now(), ...values });
      closeModal();
      activeFilter = 'all';
      activeProject = null;
      searchInput.value = '';
      setActiveFilter('all');
      render();
      showToast('Nouvelle tâche ajoutée.');
    }
  });

  $('.filter-tab').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter));
    button.addEventListener('click', () => setActiveFilter(button.dataset.filter));
  });
  searchInput.addEventListener('input', renderBoard);
  $('#task-sort').addEventListener('change', (event) => { activeSort = event.target.value; renderBoard(); });

  board.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    const card = event.target.closest('.task-card');
    if (!button || !card) return;
    const task = tasks.find((item) => String(item.id) === String(card.dataset.id));
    if (!task) return;
    if (button.classList.contains('task-edit')) openModal(task);
    if (button.classList.contains('task-delete')) deleteTask(task.id);
  });
  board.addEventListener('change', (event) => {
    const select = event.target.closest('[data-status-for]');
    if (!select) return;
    const task = tasks.find((item) => String(item.id) === String(select.dataset.statusFor));
    if (!task) return;
    task.status = select.value;
    render();
    showToast(task.status === 'Terminée' ? 'Bien joué, tâche terminée !' : 'Statut mis à jour.');
  });

  document.addEventListener('click', (event) => {
    const projectButton = event.target.closest('[data-project]');
    if (!projectButton) return;
    const project = projectButton.dataset.project;
    activeProject = activeProject === project ? null : project;
    renderProjectNavigation();
    renderProjects();
    renderBoard();
    $('#tasks').scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeSidebar();
  });
  $('#project-cards').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-project]');
    if (card) { event.preventDefault(); card.click(); }
  });

  $$('.primary-nav a').forEach((link) => link.addEventListener('click', () => {
    $$('.primary-nav a').forEach((item) => item.classList.toggle('is-active', item === link));
    closeSidebar();
  }));

  $('#menu-toggle').addEventListener('click', () => {
    const isOpen = $('#sidebar').classList.toggle('is-open');
    $('#menu-toggle').setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('sidebar-open', isOpen);
  });
  document.addEventListener('click', (event) => {
    if (document.body.classList.contains('sidebar-open') && !$('#sidebar').contains(event.target) && !$('#menu-toggle').contains(event.target)) closeSidebar();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape') {
      if (!modal.hidden) closeModal();
      closeSidebar();
    }
    if (!modal.hidden && event.key === 'Tab') {
      const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])', modal).filter((element) => !element.closest('[hidden]'));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
    }
  });
}

setCurrentDate();
bindEvents();
render();

