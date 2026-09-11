(function () {
  'use strict';

  const TASKS = [
    {
      id: 'handOver',
      label: 'Hand Over',
      galleryValue: 'hand-over',
    },
    {
      id: 'openBox',
      label: 'Open Box',
      galleryValue: 'open-box',
    },
    {
      id: 'pourWater',
      label: 'Pour Water',
      galleryValue: 'pour-water',
    },
    {
      id: 'openDrawer',
      label: 'Open Drawer',
      galleryValue: 'open-drawer',
    },
  ];
  let taskResults = [];

  function readTaskResults() {
    const results = globalThis.ROBOREACT_CONFIG?.results;
    return Array.isArray(results?.taskResults) ? results.taskResults : [];
  }

  function getNumericRate(entry, taskId) {
    const value = entry?.[taskId];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  }

  function getTaskData(taskId) {
    return taskResults
      .map((entry) => ({
        method: typeof entry?.method === 'string' ? entry.method : '',
        rate: getNumericRate(entry, taskId),
      }))
      .filter((entry) => entry.method && entry.rate !== null);
  }

  function setGalleryFilter(filterName, value) {
    const button = document.querySelector(
      `.gallery-filter[data-filter="${filterName}"] .filter-chip[data-value="${value}"]`
    );
    button?.click();
    return button;
  }

  function showRelatedVideos(task) {
    const taskButton = setGalleryFilter('task', task.galleryValue);
    setGalleryFilter('condition', 'all');
    document.querySelector('#videos')?.scrollIntoView({ block: 'start' });
    taskButton?.focus({ preventScroll: true });
    if (location.hash !== '#videos') {
      history.pushState(null, '', '#videos');
    }
  }

  function init() {
    taskResults = readTaskResults();
    if (taskResults.length === 0) return;

    const resultsSection = document.querySelector('#results');
    const tableRegion = resultsSection?.querySelector('.table-region');
    if (!resultsSection || !tableRegion || resultsSection.querySelector('[data-results-chart]')) return;

    const availableTasks = TASKS.filter((task) => getTaskData(task.id).length > 0);
    if (availableTasks.length === 0) return;

    const panel = document.createElement('section');
    panel.className = 'results-chart';
    panel.dataset.resultsChart = '';
    panel.setAttribute('aria-labelledby', 'results-chart-heading');

    const header = document.createElement('div');
    header.className = 'results-chart__header';

    const copy = document.createElement('div');
    copy.className = 'results-chart__copy';

    const kicker = document.createElement('p');
    kicker.className = 'results-chart__kicker';
    kicker.textContent = 'Task comparison';

    const heading = document.createElement('h3');
    heading.id = 'results-chart-heading';
    heading.textContent = 'Terminal success rate by method';

    copy.append(kicker, heading);

    const controls = document.createElement('div');
    controls.className = 'results-chart__controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Select task for results chart');

    const chartRegion = document.createElement('div');
    chartRegion.className = 'results-chart__plot';
    chartRegion.id = 'results-chart-plot';
    chartRegion.setAttribute('role', 'region');
    chartRegion.setAttribute('aria-labelledby', 'results-chart-heading');
    chartRegion.setAttribute('aria-describedby', 'results-chart-summary');

    const summary = document.createElement('p');
    summary.className = 'results-chart__summary';
    summary.id = 'results-chart-summary';
    summary.setAttribute('role', 'status');
    summary.setAttribute('aria-live', 'polite');
    summary.setAttribute('aria-atomic', 'true');

    const scale = document.createElement('div');
    scale.className = 'results-chart__scale';
    scale.setAttribute('aria-hidden', 'true');
    scale.innerHTML = '<span>0</span><span>50</span><span>100%</span>';

    const bars = document.createElement('div');
    bars.className = 'results-chart__bars';

    const watch = document.createElement('a');
    watch.className = 'results-watch';
    watch.href = '#videos';
    watch.textContent = 'Watch RoboReact recordings ↗';

    const taskRow = document.createElement('div');
    taskRow.className = 'results-chart__task-row';
    taskRow.append(summary, controls);
    chartRegion.append(taskRow, scale, bars, watch);
    header.append(copy);
    panel.append(header, chartRegion);

    let selectedTask = availableTasks.find((task) => task.id === 'pourWater') || availableTasks[0];
    const buttons = new Map();

    function renderTask(task) {
      selectedTask = task;
      for (const [taskId, button] of buttons) {
        button.setAttribute('aria-pressed', String(taskId === task.id));
      }

      const data = getTaskData(task.id);
      bars.replaceChildren();
      for (const entry of data) {
        const row = document.createElement('div');
        row.className = 'results-chart__row';
        row.dataset.resultMethod = entry.method;
        row.dataset.successRate = String(entry.rate);
        row.style.setProperty('--result-value', String(entry.rate));

        const method = document.createElement('span');
        method.className = 'results-chart__method';
        method.textContent = entry.method;

        const track = document.createElement('span');
        track.className = 'results-chart__track';

        const fill = document.createElement('span');
        fill.className = 'results-chart__fill';
        if (entry.method === 'RoboReact') fill.dataset.primary = 'true';

        const value = document.createElement('span');
        value.className = 'results-chart__value';
        value.textContent = `${entry.rate}%`;

        track.append(fill);
        row.append(method, track, value);
        bars.append(row);
      }

      summary.textContent = `${task.label} / Success rate (%)`;
      watch.setAttribute('aria-label', `Watch RoboReact recordings for ${task.label}`);
    }

    for (const task of availableTasks) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'results-chart__task';
      button.dataset.resultsTask = task.id;
      button.setAttribute('aria-controls', chartRegion.id);
      button.textContent = task.label;
      button.addEventListener('click', () => renderTask(task));
      controls.append(button);
      buttons.set(task.id, button);
    }

    watch.addEventListener('click', (event) => {
      event.preventDefault();
      showRelatedVideos(selectedTask);
    });

    tableRegion.before(panel);
    renderTask(selectedTask);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
