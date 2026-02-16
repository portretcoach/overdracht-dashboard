// === State ===
const STORAGE_KEYS = {
    calendar: 'birdnest_calendar',
    notes: 'birdnest_notes',
    settings: 'birdnest_settings',
};

const DAYS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

// === LocalStorage Helpers ===
function loadData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// === Settings ===
const DEFAULT_SETTINGS = {
    parentA: 'Iris',
    parentB: 'Koen',
    child1: 'Kind 1',
    child2: 'Kind 2',
};

function getSettings() {
    // One-time reset to fix incorrect stored names
    const migrated = localStorage.getItem('birdnest_settings_v2');
    if (!migrated) {
        localStorage.removeItem(STORAGE_KEYS.settings);
        localStorage.setItem('birdnest_settings_v2', 'true');
    }
    return loadData(STORAGE_KEYS.settings) || { ...DEFAULT_SETTINGS };
}

function initSettings() {
    const settings = getSettings();
    document.getElementById('parent-a-name').value = settings.parentA;
    document.getElementById('parent-b-name').value = settings.parentB;
    document.getElementById('child-1-name').value = settings.child1;
    document.getElementById('child-2-name').value = settings.child2;

    document.getElementById('save-settings').addEventListener('click', () => {
        const newSettings = {
            parentA: document.getElementById('parent-a-name').value.trim() || DEFAULT_SETTINGS.parentA,
            parentB: document.getElementById('parent-b-name').value.trim() || DEFAULT_SETTINGS.parentB,
            child1: document.getElementById('child-1-name').value.trim() || DEFAULT_SETTINGS.child1,
            child2: document.getElementById('child-2-name').value.trim() || DEFAULT_SETTINGS.child2,
        };
        saveData(STORAGE_KEYS.settings, newSettings);
        updateWeekSection();
        renderNotes();
    });
}

// === Calendar Data ===
function getCalendarData() {
    return loadData(STORAGE_KEYS.calendar) || {};
}

function getDayParent(dateStr) {
    const data = getCalendarData();
    return data[dateStr] || null;
}

function dateToStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// === Week Section ===
function updateWeekSection() {
    const settings = getSettings();
    updateWeekOverview(settings);
}

// ISO week number calculation
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function updateWeekOverview(settings) {
    const container = document.getElementById('week-overview');
    container.innerHTML = '';
    const today = new Date();
    const todayDow = today.getDay();
    // Calculate Monday of current week
    const monday = new Date(today);
    const diff = todayDow === 0 ? -6 : 1 - todayDow;
    monday.setDate(today.getDate() + diff);

    // Show whose week it is (odd = Iris, even = Koen)
    const weekNum = getWeekNumber(today);
    const weekParentEl = document.getElementById('week-parent');
    const isOdd = weekNum % 2 !== 0;
    const weekParentName = isOdd ? settings.parentA : settings.parentB;
    const weekParentClass = isOdd ? 'parent-a' : 'parent-b';
    weekParentEl.innerHTML = `<span class="week-parent-badge ${weekParentClass}">Week ${weekNum} — ${weekParentName}</span>`;

    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dateStr = dateToStr(date);
        const parent = getDayParent(dateStr);

        const dayEl = document.createElement('div');
        dayEl.className = 'week-day';
        if (parent === 'A') dayEl.classList.add('parent-a');
        if (parent === 'B') dayEl.classList.add('parent-b');
        if (dateStr === dateToStr(today)) dayEl.classList.add('is-today');

        const label = document.createElement('span');
        label.className = 'day-label';
        label.textContent = DAYS_NL[i];

        const num = document.createElement('span');
        num.className = 'day-num';
        num.textContent = date.getDate();

        dayEl.appendChild(label);
        dayEl.appendChild(num);
        container.appendChild(dayEl);
    }
}

// === Notes ===
function getNotes() {
    return loadData(STORAGE_KEYS.notes) || [];
}

function saveNotes(notes) {
    saveData(STORAGE_KEYS.notes, notes);
}

function renderNotes() {
    const settings = getSettings();
    const notes = getNotes();
    const container = document.getElementById('notes-list');
    container.innerHTML = '';

    // Sort by date descending
    const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date));

    if (sorted.length === 0) {
        container.innerHTML = '<p style="color: var(--color-text-light); font-size: 0.9rem;">Nog geen notities.</p>';
        return;
    }

    sorted.forEach((note) => {
        const item = document.createElement('div');
        item.className = 'note-item';

        const dateObj = new Date(note.date + 'T00:00:00');
        const dateOptions = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' };
        const dateFormatted = dateObj.toLocaleDateString('nl-NL', dateOptions);

        // Show which parent is assigned that day
        const parent = getDayParent(note.date);
        let parentLabel = '';
        if (parent === 'A') parentLabel = ` — ${settings.parentA}`;
        if (parent === 'B') parentLabel = ` — ${settings.parentB}`;

        item.innerHTML = `
            <div class="note-content">
                <div class="note-date">${dateFormatted}${parentLabel}</div>
                <div class="note-text">${escapeHtml(note.text)}</div>
            </div>
            <button class="btn-delete" title="Verwijderen" data-id="${note.id}">&times;</button>
        `;

        item.querySelector('.btn-delete').addEventListener('click', () => {
            const updated = getNotes().filter(n => n.id !== note.id);
            saveNotes(updated);
            renderNotes();
        });

        container.appendChild(item);
    });
}

function initNoteForm() {
    const form = document.getElementById('note-form');
    const dateInput = document.getElementById('note-date');

    // Default date to today
    dateInput.value = dateToStr(new Date());

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = dateInput.value;
        const text = document.getElementById('note-text').value.trim();

        if (!date || !text) return;

        const notes = getNotes();
        notes.push({
            id: Date.now().toString(),
            date,
            text,
            created: new Date().toISOString(),
        });
        saveNotes(notes);
        renderNotes();

        // Reset form
        document.getElementById('note-text').value = '';
        dateInput.value = dateToStr(new Date());
    });
}

// === Utility ===
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// === Checklist Factory ===
function createChecklist(storageKey, listId, formId, inputId, emptyMsg) {
    function getItems() {
        return loadData(storageKey) || [];
    }
    function saveItems(items) {
        saveData(storageKey, items);
    }
    function render() {
        const list = document.getElementById(listId);
        list.innerHTML = '';
        const items = getItems();

        if (items.length === 0) {
            list.innerHTML = `<li style="color: var(--color-text-light); font-size: 0.9rem; padding: 0.4rem 0;">${emptyMsg}</li>`;
            return;
        }

        items.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'transfer-note-item' + (item.checked ? ' checked' : '');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = item.checked;
            checkbox.addEventListener('change', () => {
                const all = getItems();
                const found = all.find(n => n.id === item.id);
                if (found) found.checked = checkbox.checked;
                saveItems(all);
                render();
            });

            const label = document.createElement('span');
            label.className = 'note-label';
            label.textContent = item.text;
            label.addEventListener('click', () => {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            });

            const btn = document.createElement('button');
            btn.className = 'btn-delete-transfer';
            btn.title = 'Verwijderen';
            btn.innerHTML = '&times;';
            btn.addEventListener('click', () => {
                const all = getItems().filter(n => n.id !== item.id);
                saveItems(all);
                render();
            });

            li.appendChild(checkbox);
            li.appendChild(label);
            li.appendChild(btn);
            list.appendChild(li);
        });
    }
    function initForm() {
        const form = document.getElementById(formId);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById(inputId);
            const text = input.value.trim();
            if (!text) return;
            const items = getItems();
            items.push({ id: Date.now().toString(), text, checked: false });
            saveItems(items);
            render();
            input.value = '';
        });
    }
    return { render, initForm };
}

// === Transfer Notes (3 categories) ===
const mayaChecklist = createChecklist('birdnest_transfer_maya', 'transfer-notes-list-maya', 'transfer-note-form-maya', 'transfer-note-input-maya', 'Geen notities.');
const izzieChecklist = createChecklist('birdnest_transfer_izzie', 'transfer-notes-list-izzie', 'transfer-note-form-izzie', 'transfer-note-input-izzie', 'Geen notities.');
const hondenChecklist = createChecklist('birdnest_transfer_honden', 'transfer-notes-list-honden', 'transfer-note-form-honden', 'transfer-note-input-honden', 'Geen notities.');

// === House Notes ===
const houseChecklist = createChecklist('birdnest_house_notes', 'house-notes-list', 'house-note-form', 'house-note-input', 'Geen notities over het huis.');

// === Cleaning Checklist ===
const DEFAULT_CLEANING_TASKS = [
    'Stofzuigen woonkamer',
    'Stofzuigen slaapkamers',
    'Dweilen vloeren',
    'Keuken aanrecht & kookplaat schoonmaken',
    'Afwas / vaatwasser in- en uitruimen',
    'Badkamer schoonmaken (douche, wastafel, toilet)',
    'Toilet schoonmaken',
    'Prullenbakken legen',
    'Wasgoed wassen, drogen en opvouwen',
    'Bedden verschonen',
    'Spiegels en glazen oppervlakken schoonmaken',
    'Eettafel afnemen',
    'Koelkast check (verlopen producten)',
];

function getCleaningTasks() {
    const saved = loadData('birdnest_cleaning');
    if (saved && saved.length > 0) return saved;
    // First time: load defaults
    const defaults = DEFAULT_CLEANING_TASKS.map((text, i) => ({
        id: (Date.now() + i).toString(),
        text,
        checked: false,
    }));
    saveCleaningTasks(defaults);
    return defaults;
}

function saveCleaningTasks(tasks) {
    saveData('birdnest_cleaning', tasks);
}

function renderCleaningTasks() {
    const list = document.getElementById('cleaning-list');
    const progressEl = document.getElementById('cleaning-progress');
    const resetBtn = document.getElementById('cleaning-reset');
    list.innerHTML = '';
    const tasks = getCleaningTasks();

    if (tasks.length === 0) {
        list.innerHTML = '<li style="color: var(--color-text-light); font-size: 0.9rem; padding: 0.4rem 0;">Geen schoonmaaktaken.</li>';
        progressEl.textContent = '';
        resetBtn.style.display = 'none';
        return;
    }

    const done = tasks.filter(t => t.checked).length;
    const total = tasks.length;
    progressEl.textContent = `${done}/${total} klaar`;

    if (done === total) {
        progressEl.classList.add('all-done');
        resetBtn.style.display = 'inline-block';
    } else {
        progressEl.classList.remove('all-done');
        resetBtn.style.display = 'none';
    }

    tasks.forEach((task) => {
        const li = document.createElement('li');
        li.className = 'transfer-note-item' + (task.checked ? ' checked' : '');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.checked;
        checkbox.addEventListener('change', () => {
            const all = getCleaningTasks();
            const found = all.find(t => t.id === task.id);
            if (found) found.checked = checkbox.checked;
            saveCleaningTasks(all);
            renderCleaningTasks();
        });

        const label = document.createElement('span');
        label.className = 'note-label';
        label.textContent = task.text;
        label.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });

        const btn = document.createElement('button');
        btn.className = 'btn-delete-transfer';
        btn.title = 'Verwijderen';
        btn.innerHTML = '&times;';
        btn.addEventListener('click', () => {
            const all = getCleaningTasks().filter(t => t.id !== task.id);
            saveCleaningTasks(all);
            renderCleaningTasks();
        });

        li.appendChild(checkbox);
        li.appendChild(label);
        li.appendChild(btn);
        list.appendChild(li);
    });
}

function initCleaningForm() {
    const form = document.getElementById('cleaning-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('cleaning-input');
        const text = input.value.trim();
        if (!text) return;

        const tasks = getCleaningTasks();
        tasks.push({ id: Date.now().toString(), text, checked: false });
        saveCleaningTasks(tasks);
        renderCleaningTasks();
        input.value = '';
    });

    document.getElementById('cleaning-reset').addEventListener('click', () => {
        const tasks = getCleaningTasks();
        tasks.forEach(t => t.checked = false);
        saveCleaningTasks(tasks);
        renderCleaningTasks();
    });
}

// === Init ===
function init() {
    initSettings();
    updateWeekSection();
    mayaChecklist.initForm(); mayaChecklist.render();
    izzieChecklist.initForm(); izzieChecklist.render();
    hondenChecklist.initForm(); hondenChecklist.render();
    houseChecklist.initForm(); houseChecklist.render();
    initCleaningForm();
    renderCleaningTasks();
    initNoteForm();
    renderNotes();
}

document.addEventListener('DOMContentLoaded', init);
