// Service worker for To do extension
// Handles popup toggle and task storage

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'togglePopup' });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTasks') {
    chrome.storage.local.get(['todoTasks'], (result) => {
      const tasks = result.todoTasks || [];
      sendResponse({ tasks });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'addTask') {
    const text = request.text?.trim();
    if (!text) {
      sendResponse({ success: false });
      return;
    }

    chrome.storage.local.get(['todoTasks'], (result) => {
      const tasks = result.todoTasks || [];
      tasks.push({
        id: Date.now(),
        text,
        created: new Date().toISOString()
      });
      chrome.storage.local.set({ todoTasks: tasks }, () => {
        sendResponse({ success: true, tasks });
      });
    });
    return true;
  }

  if (request.action === 'deleteTask') {
    const taskId = request.taskId;
    chrome.storage.local.get(['todoTasks'], (result) => {
      const tasks = result.todoTasks || [];
      const filtered = tasks.filter((task) => task.id !== taskId);
      chrome.storage.local.set({ todoTasks: filtered }, () => {
        sendResponse({ success: true, tasks: filtered });
      });
    });
    return true;
  }
});
