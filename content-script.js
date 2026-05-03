// Content script for Tada extension
// Injects popup sidebar and handles user interactions

let popupVisible = false;
let currentPosition = 'top-right'; // Default position
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

const POSITION_MAP = {
  'top-left': { top: '10px', right: 'auto', bottom: 'auto', left: '10px' },
  'top-center': { top: '10px', right: 'auto', bottom: 'auto', left: '50%', transform: 'translateX(-50%)' },
  'top-right': { top: '10px', right: '10px', bottom: 'auto', left: 'auto' },
  'middle-left': { top: '50%', right: 'auto', bottom: 'auto', left: '10px', transform: 'translateY(-50%)' },
  'center': { top: '50%', right: 'auto', bottom: 'auto', left: '50%', transform: 'translate(-50%, -50%)' },
  'middle-right': { top: '50%', right: '10px', bottom: 'auto', left: 'auto', transform: 'translateY(-50%)' },
  'bottom-left': { bottom: '10px', right: 'auto', top: 'auto', left: '10px' },
  'bottom-center': { bottom: '10px', right: 'auto', top: 'auto', left: '50%', transform: 'translateX(-50%)' },
  'bottom-right': { bottom: '10px', right: '10px', top: 'auto', left: 'auto' }
};

// Load CSS
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = chrome.runtime.getURL('popup.css');
document.head.appendChild(link);

function createPopup() {
  if (document.getElementById('tada-popup-container')) {
    return;
  }

  const container = document.createElement('div');
  container.id = 'tada-popup-container';

  const sidebar = document.createElement('div');
  sidebar.className = 'tada-sidebar';

  const header = document.createElement('div');
  header.className = 'tada-header';
  header.innerHTML = '<h2>Tada</h2>';
  header.style.cursor = 'grab';

  // Drag functionality
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return; // Don't drag when clicking buttons
    isDragging = true;
    const container = document.getElementById('tada-popup-container');
    const rect = container.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    header.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const container = document.getElementById('tada-popup-container');
    container.style.left = (e.clientX - dragOffset.x) + 'px';
    container.style.top = (e.clientY - dragOffset.y) + 'px';
    container.style.right = 'auto';
    container.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    header.style.cursor = 'grab';
  });

  const headerBtns = document.createElement('div');
  headerBtns.className = 'tada-header-btns';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'tada-icon-btn';
  exportBtn.textContent = '⬇';
  exportBtn.title = 'Export as CSV';
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportTasksCSV();
  });

  const importBtn = document.createElement('button');
  importBtn.className = 'tada-icon-btn';
  importBtn.textContent = '⬆';
  importBtn.title = 'Import from CSV';
  importBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.addEventListener('change', (ev) => importTasksCSV(ev));
    input.click();
  });

  const githubBtn = document.createElement('a');
  githubBtn.className = 'tada-github-btn';
  githubBtn.href = 'https://github.com/affigabmag/Tada';
  githubBtn.target = '_blank';
  githubBtn.rel = 'noopener noreferrer';
  githubBtn.title = 'View on GitHub';
  githubBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
  </svg>`;

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'tada-settings-btn';
  settingsBtn.textContent = '⚙';
  settingsBtn.title = 'Position settings';
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettings();
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tada-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closePopup());

  headerBtns.appendChild(importBtn);
  headerBtns.appendChild(exportBtn);
  headerBtns.appendChild(settingsBtn);
  headerBtns.appendChild(githubBtn);
  headerBtns.appendChild(closeBtn);
  header.appendChild(headerBtns);

  // Settings panel
  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'tada-settings-panel';
  settingsPanel.id = 'tada-settings-panel';
  settingsPanel.style.display = 'none';

  const positionLabel = document.createElement('div');
  positionLabel.className = 'tada-position-label';
  positionLabel.textContent = 'Position Selector';

  const positionGrid = document.createElement('div');
  positionGrid.className = 'tada-position-grid';

  const positions = [
    ['top-left', 'top-center', 'top-right'],
    ['middle-left', 'center', 'middle-right'],
    ['bottom-left', 'bottom-center', 'bottom-right']
  ];

  positions.forEach((row) => {
    row.forEach((pos) => {
      const cell = document.createElement('button');
      cell.className = 'tada-position-cell';
      cell.dataset.position = pos;
      cell.title = pos.replace('-', ' ');
      cell.addEventListener('click', () => setPosition(pos));
      positionGrid.appendChild(cell);
    });
  });

  settingsPanel.appendChild(positionLabel);
  settingsPanel.appendChild(positionGrid);

  // Input wrapper
  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'tada-input-wrapper';
  inputWrapper.id = 'tada-input-wrapper';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tada-input';
  input.placeholder = 'Add a new task…';
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTask(input.value);
      input.value = '';
      input.focus();
    }
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'tada-add-btn';
  addBtn.textContent = '+';
  addBtn.title = 'Add task';
  addBtn.addEventListener('click', () => {
    addTask(input.value);
    input.value = '';
    input.focus();
  });

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(addBtn);

  const taskList = document.createElement('div');
  taskList.className = 'tada-task-list';
  taskList.id = 'tada-task-list';

  sidebar.appendChild(header);
  sidebar.appendChild(settingsPanel);
  sidebar.appendChild(inputWrapper);
  sidebar.appendChild(taskList);
  container.appendChild(sidebar);

  document.body.appendChild(container);

  // Load existing tasks
  loadTasks();

  // Load popup state and apply it
  loadPopupState();

  // Load popup position and apply it
  loadPosition();
}

function togglePopup() {
  const container = document.getElementById('tada-popup-container');
  if (container) {
    popupVisible = !popupVisible;
    applyPopupState();
  }
}

function closePopup() {
  popupVisible = false;
  applyPopupState();
}

function toggleSettings() {
  const panel = document.getElementById('tada-settings-panel');
  const inputWrapper = document.getElementById('tada-input-wrapper');
  if (panel) {
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    if (inputWrapper) {
      inputWrapper.style.display = isVisible ? 'flex' : 'none';
    }
  }
}

function setPosition(position) {
  currentPosition = position;
  applyPosition();
  chrome.storage.local.set({ todoPosition: position });
  // Update grid selection visual
  updatePositionGrid();
  // Close settings panel
  const panel = document.getElementById('tada-settings-panel');
  const inputWrapper = document.getElementById('tada-input-wrapper');
  if (panel) {
    panel.style.display = 'none';
    if (inputWrapper) {
      inputWrapper.style.display = 'flex';
    }
  }
}

function applyPosition() {
  const container = document.getElementById('tada-popup-container');
  if (container && POSITION_MAP[currentPosition]) {
    // Clear all position properties first
    container.style.top = 'auto';
    container.style.right = 'auto';
    container.style.bottom = 'auto';
    container.style.left = 'auto';
    container.style.transform = 'none';

    // Apply new position
    const styles = POSITION_MAP[currentPosition];
    Object.assign(container.style, styles);
  }
}

function loadPosition() {
  chrome.storage.local.get(['todoPosition'], (result) => {
    if (result.todoPosition) {
      currentPosition = result.todoPosition;
    }
    applyPosition();
    updatePositionGrid();
  });
}

function updatePositionGrid() {
  const cells = document.querySelectorAll('.tada-position-cell');
  cells.forEach((cell) => {
    if (cell.dataset.position === currentPosition) {
      cell.classList.add('active');
    } else {
      cell.classList.remove('active');
    }
  });
}

function applyPopupState() {
  const container = document.getElementById('tada-popup-container');
  if (container) {
    container.style.display = popupVisible ? 'block' : 'none';
    if (popupVisible) {
      document.querySelector('.tada-input')?.focus();
    }
    // Save state to storage
    chrome.storage.local.set({ popupVisible });
  }
}

function loadPopupState() {
  chrome.storage.local.get(['popupVisible'], (result) => {
    // Default to false (closed) on first run
    popupVisible = result.popupVisible === true;
    const container = document.getElementById('tada-popup-container');
    if (container) {
      container.style.display = popupVisible ? 'block' : 'none';
    }
  });
}

function addTask(text) {
  if (!text.trim()) return;

  chrome.runtime.sendMessage(
    { action: 'addTask', text },
    (response) => {
      if (response.success) {
        renderTasks(response.tasks);
      }
    }
  );
}

function deleteTask(index) {
  chrome.runtime.sendMessage(
    { action: 'deleteTask', index },
    (response) => {
      if (response.success) {
        renderTasks(response.tasks);
      }
    }
  );
}

function loadTasks() {
  chrome.runtime.sendMessage(
    { action: 'getTasks' },
    (response) => {
      renderTasks(response.tasks);
    }
  );
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  // Format as date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderTasks(tasks) {
  const taskList = document.getElementById('tada-task-list');
  if (!taskList) return;

  taskList.innerHTML = '';

  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tada-empty';
    empty.textContent = 'No tasks yet';
    taskList.appendChild(empty);
    return;
  }

  tasks.forEach((task, index) => {
    const taskEl = document.createElement('div');
    taskEl.className = 'tada-task-item';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'tada-task-content';

    const taskText = document.createElement('span');
    taskText.className = 'tada-task-text';
    taskText.textContent = task.text;

    const taskTime = document.createElement('span');
    taskTime.className = 'tada-task-time';
    taskTime.textContent = formatTime(task.created);

    contentWrapper.appendChild(taskText);
    contentWrapper.appendChild(taskTime);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tada-delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', () => deleteTask(index));

    taskEl.appendChild(contentWrapper);
    taskEl.appendChild(deleteBtn);
    taskList.appendChild(taskEl);
  });
}

function exportTasksCSV() {
  chrome.storage.local.get(['todoTasks'], (result) => {
    const tasks = result.todoTasks || [];
    if (tasks.length === 0) {
      alert('No tasks to export');
      return;
    }

    // Create CSV content
    let csv = 'Task,Created\n';
    tasks.forEach((task) => {
      const text = `"${task.text.replace(/"/g, '""')}"`;
      const created = task.created ? new Date(task.created).toLocaleString() : '';
      csv += `${text},"${created}"\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tada-tasks-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  });
}

function importTasksCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csv = e.target.result;
      const lines = csv.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        alert('Invalid CSV format');
        return;
      }

      // Skip header row
      const rows = lines.slice(1);
      chrome.storage.local.get(['todoTasks'], (result) => {
        const existingTasks = result.todoTasks || [];

        rows.forEach((row) => {
          // Simple CSV parsing (handles quoted fields)
          const match = row.match(/"([^"]*)"|([^,]*)/g);
          if (match && match[0]) {
            const taskText = match[0].replace(/^"|"$/g, '').replace(/""/g, '"');
            if (taskText.trim()) {
              existingTasks.push({
                id: Date.now() + Math.random(),
                text: taskText,
                created: new Date().toISOString()
              });
            }
          }
        });

        chrome.storage.local.set({ todoTasks: existingTasks }, () => {
          loadTasks();
          alert(`Imported ${rows.length} task(s)`);
        });
      });
    } catch (error) {
      alert('Error importing CSV: ' + error.message);
    }
  };
  reader.readAsText(file);
}

// Create popup on page load
createPopup();

// Listen for toggle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'togglePopup') {
    togglePopup();
    sendResponse({ success: true });
  }
});
