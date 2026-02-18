// ============================================================
// SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = 'https://arsicfpcitwlsnwinylx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyc2ljZnBjaXR3bHNud2lueWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDcwOTAsImV4cCI6MjA4Njk4MzA5MH0.BTBgo3RZm6XXPbqCOPa7zPZbv2cDu9KxA_d1Qw6bGVM';

// Simple Supabase REST API helper
async function db(table, method = 'GET', body = null, filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=representation'
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let loginRole = 'student';
let cachedAssignments = [];

// ============================================================
// INIT — load assignments on page load
// ============================================================
window.addEventListener('load', async () => {
  await loadAssignments();
});

async function loadAssignments() {
  try {
    cachedAssignments = await db('assignments', 'GET', null, '?order=created_at.asc');
    updateHeroStats();
    if (document.getElementById('view-assignments').classList.contains('active')) {
      renderPublicAssignments();
    }
  } catch (e) {
    console.error('Failed to load assignments:', e);
  }
}

function updateHeroStats() {
  const count = cachedAssignments.length;
  const countEl = document.getElementById('heroAssignCount');
  const cardEl = document.getElementById('cardAssignCount');
  const countBadge = document.getElementById('assignCount');
  if (countEl) countEl.innerHTML = `${count}<span class="unit"> tasks</span>`;
  if (cardEl) cardEl.textContent = count + ' Active';
  if (countBadge) countBadge.textContent = count + ' assignments';

  // Next due
  const future = cachedAssignments.filter(a => new Date(a.due_date) >= new Date());
  future.sort((a,b) => new Date(a.due_date) - new Date(b.due_date));
  const nextDue = document.getElementById('cardNextDue');
  if (nextDue && future.length) nextDue.textContent = future[0].due_date;
}

// ============================================================
// NAV
// ============================================================
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  if (id === 'assignments') renderPublicAssignments();
  if (id === 'grades') renderPublicGrades();
  if (id === 'dashboard') renderDashboard();
}

function setActiveNav(el) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  el.classList.add('active');
}

// ============================================================
// MODAL / LOGIN
// ============================================================
function openModal() { document.getElementById('loginOverlay').classList.add('open'); }
function closeModal() { document.getElementById('loginOverlay').classList.remove('open'); }

document.getElementById('loginOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function setRole(r) {
  loginRole = r;
  document.getElementById('roleStudent').classList.toggle('active', r === 'student');
  document.getElementById('roleTeacher').classList.toggle('active', r === 'teacher');
  document.getElementById('studentFields').style.display = r === 'student' ? '' : 'none';
  document.getElementById('passHint').innerHTML = r === 'teacher'
    ? 'Teacher password: <strong>teacher123</strong>'
    : 'Student password: <strong>student123</strong>';
}

async function doLogin() {
  const pass = document.getElementById('loginPass').value.trim();
  const btn = document.getElementById('loginSubmitBtn');
  if (!pass) { showToast('⚠️ Please enter your password'); return; }

  btn.textContent = '⏳ Signing in...';
  btn.disabled = true;

  try {
    if (loginRole === 'teacher') {
      if (pass !== 'teacher123') { showToast('❌ Wrong teacher password'); return; }
      currentUser = { role: 'teacher', name: 'Dr. Nooman Zadran' };
    } else {
      const email = document.getElementById('loginEmail').value.trim();
      if (!email) { showToast('⚠️ Please enter your email'); return; }
      // Check student in database
      const results = await db('students', 'GET', null, `?email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(pass)}`);
      if (!results || results.length === 0) {
        showToast('❌ Wrong email or password');
        return;
      }
      currentUser = { role: 'student', name: results[0].name, email: results[0].email, id: results[0].id };
    }

    closeModal();
    document.getElementById('loginPass').value = '';
    if (document.getElementById('loginEmail')) document.getElementById('loginEmail').value = '';
    updateNavUser();
    showView('dashboard');
    showToast('✅ Welcome, ' + currentUser.name.split(' ')[0] + '!');
  } catch (e) {
    showToast('❌ Login failed. Check connection.');
    console.error(e);
  } finally {
    btn.textContent = '🚀 Sign In';
    btn.disabled = false;
  }
}

function doLogout() {
  currentUser = null;
  document.getElementById('loginBtn').style.display = '';
  document.getElementById('userChip').style.display = 'none';
  showView('home');
  showToast('👋 Signed out successfully');
}

function updateNavUser() {
  document.getElementById('loginBtn').style.display = 'none';
  document.getElementById('userChip').style.display = '';
  document.getElementById('chipName').textContent = currentUser.name.split(' ')[0];
  document.getElementById('chipAvatar').textContent = currentUser.name.split(' ').map(w => w[0]).slice(0, 2).join('');
}

// ============================================================
// PUBLIC ASSIGNMENTS
// ============================================================
async function renderPublicAssignments() {
  const grid = document.getElementById('assignGrid');
  grid.innerHTML = '<div class="loading-state">⏳ Loading assignments...</div>';

  try {
    if (!cachedAssignments.length) await loadAssignments();
    const assignments = cachedAssignments;
    document.getElementById('assignCount').textContent = assignments.length + ' assignments';

    if (!assignments.length) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No assignments yet</div></div>';
      return;
    }

    // Get current user submissions if logged in
    let mySubmissions = [];
    let myGrades = [];
    if (currentUser && currentUser.role === 'student') {
      mySubmissions = await db('submissions', 'GET', null, `?student_name=eq.${encodeURIComponent(currentUser.name)}`);
      myGrades = await db('grades', 'GET', null, `?student_name=eq.${encodeURIComponent(currentUser.name)}`);
    }

    grid.innerHTML = assignments.map((a, i) => {
      const sub = mySubmissions.find(s => s.assignment_id === a.id);
      const graded = myGrades.find(g => g.assignment_id === a.id);
      let btnClass = 'submit-btn', btnText = '📤 Submit Assignment', btnAction = `handleSubmit('${a.id}','${a.title}')`;
      if (graded) { btnClass = 'submit-btn graded'; btnText = `✅ Graded: ${graded.score}/${a.points}`; btnAction = ''; }
      else if (sub) { btnClass = 'submit-btn submitted'; btnText = '✅ Submitted — Awaiting Grade'; btnAction = ''; }
      return `
      <div class="assign-card">
        <div class="assign-card-top">
          <div class="assign-num">0${i+1}</div>
          <div class="assign-icon">${a.icon || '📝'}</div>
          <div class="assign-title">${a.title}</div>
        </div>
        <div class="assign-card-body">
          <div class="assign-desc">${a.description || ''}</div>
          <div class="assign-footer">
            <span class="due-badge">⏰ ${a.due_date}</span>
            <span class="points-badge">🏆 ${a.points} pts</span>
          </div>
          <button class="${btnClass}" ${btnAction ? `onclick="${btnAction}"` : 'disabled'}>${btnText}</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">Failed to load. Check connection.</div></div>';
    console.error(e);
  }
}

async function handleSubmit(assignmentId, title) {
  if (!currentUser) { openModal(); return; }
  try {
    const fileName = currentUser.name.replace(/ /g, '_') + '_' + title.replace(/ /g, '_') + '.pdf';
    await db('submissions', 'POST', {
      student_name: currentUser.name,
      assignment_id: assignmentId,
      file_name: fileName
    });
    showToast('📤 Submitted: ' + title);
    renderPublicAssignments();
  } catch (e) {
    // Might already be submitted
    showToast('⚠️ Already submitted or error occurred');
  }
}

// ============================================================
// PUBLIC GRADES
// ============================================================
async function renderPublicGrades() {
  const c = document.getElementById('gradesContent');
  if (!currentUser) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-title">Sign in to view grades</div><button class="btn-modal" style="max-width:180px;margin:1rem auto 0;" onclick="openModal()">Sign In</button></div>`;
    return;
  }
  c.innerHTML = '<div class="loading-state">⏳ Loading grades...</div>';
  try {
    const assignments = cachedAssignments.length ? cachedAssignments : await db('assignments', 'GET', null, '?order=created_at.asc');
    const grades = await db('grades', 'GET', null, `?student_name=eq.${encodeURIComponent(currentUser.name)}`);

    const rows = assignments.map(a => {
      const g = grades.find(x => x.assignment_id === a.id);
      if (!g) return `<div class="grades-row"><div class="grade-name">${a.icon||'📝'} ${a.title}</div><div style="color:var(--text-muted)">—</div><div>—</div><div><span class="hero-card-pill pill-blue">Pending</span></div><div></div></div>`;
      const pct = Math.round((g.score / a.points) * 100);
      const letter = getLetter(g.score, a.points);
      return `<div class="grades-row">
        <div class="grade-name">${a.icon||'📝'} ${a.title}</div>
        <div class="grade-score">${g.score}/${a.points}</div>
        <div><span class="grade-letter gl-${letter}">${letter}</span></div>
        <div><span class="hero-card-pill pill-green">✅ Graded</span></div>
        <div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><span class="progress-pct">${pct}%</span></div>
      </div>`;
    }).join('');
    c.innerHTML = `<div class="grades-wrap"><div class="grades-head"><div>Assignment</div><div>Score</div><div>Grade</div><div>Status</div><div>Progress</div></div>${rows}</div>`;
  } catch (e) {
    c.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">Failed to load grades</div></div>';
  }
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
  if (!currentUser) return;
  document.getElementById('dashName').textContent = currentUser.name.split(' ')[0];
  document.getElementById('dashSubtitle').textContent = currentUser.role === 'teacher'
    ? '👨‍🏫 Teacher Dashboard — Manage your class.'
    : '🎓 Student Portal — Track your work and grades.';

  if (currentUser.role === 'student') await renderStudentDash();
  else await renderTeacherDash();
}

// ---- STUDENT DASHBOARD ----
async function renderStudentDash() {
  const assignments = cachedAssignments.length ? cachedAssignments : await db('assignments', 'GET', null, '?order=created_at.asc');
  const submissions = await db('submissions', 'GET', null, `?student_name=eq.${encodeURIComponent(currentUser.name)}`);
  const grades = await db('grades', 'GET', null, `?student_name=eq.${encodeURIComponent(currentUser.name)}`);

  const avgPct = grades.length
    ? Math.round(grades.reduce((s, g) => {
        const a = assignments.find(x => x.id === g.assignment_id);
        return s + (a ? (g.score / a.points * 100) : 0);
      }, 0) / grades.length)
    : 0;

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card"><div class="stat-icon purple">📝</div><div><div class="stat-value">${assignments.length}</div><div class="stat-label">Assignments</div></div></div>
    <div class="stat-card"><div class="stat-icon yellow">📤</div><div><div class="stat-value">${submissions.length}</div><div class="stat-label">Submitted</div></div></div>
    <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${grades.length}</div><div class="stat-label">Graded</div></div></div>
    <div class="stat-card"><div class="stat-icon blue">🏆</div><div><div class="stat-value">${avgPct}%</div><div class="stat-label">Average</div></div></div>`;

  document.getElementById('dashTabBar').innerHTML = `
    <button class="tab-btn active" onclick="switchTab('my-work',this)">📝 My Assignments</button>
    <button class="tab-btn" onclick="switchTab('my-grades',this)">📊 My Grades</button>`;

  document.getElementById('pane-my-work').classList.add('active');

  // My work
  document.getElementById('myWorkContent').innerHTML = assignments.map(a => {
    const sub = submissions.find(s => s.assignment_id === a.id);
    const graded = grades.find(g => g.assignment_id === a.id);
    return `
    <div class="posted-assign-item" style="flex-direction:column;align-items:stretch;gap:0.8rem;margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
        <div><div class="pa-title">${a.icon||'📝'} ${a.title}</div><div class="pa-meta">Due: ${a.due_date} · ${a.points} points</div></div>
        <div>${graded
          ? `<span class="hero-card-pill pill-green">✅ Graded: ${graded.score}/${a.points} (${getLetter(graded.score, a.points)})</span>`
          : sub ? '<span class="hero-card-pill pill-blue">⏳ Awaiting Grade</span>'
          : '<span class="hero-card-pill pill-red">⚠️ Not Submitted</span>'}</div>
      </div>
      ${!graded && !sub ? `<div class="file-drop" onclick="studentSubmit('${a.id}','${a.title}')">
        <div class="file-drop-icon">📎</div>
        <div class="file-drop-text">Click to submit your work · <strong>Simulates file upload</strong></div>
      </div>` : sub && !graded ? `<div style="padding:0.7rem 1rem;background:var(--info-light);border-radius:8px;font-size:0.8rem;color:var(--info);">📎 Submitted: <strong>${sub.file_name}</strong></div>` : ''}
    </div>`;
  }).join('');

  // My grades
  const gRows = assignments.map(a => {
    const g = grades.find(x => x.assignment_id === a.id);
    if (!g) return `<div class="grades-row"><div class="grade-name">${a.icon||'📝'} ${a.title}</div><div style="color:var(--text-muted)">—</div><div>—</div><div><span class="hero-card-pill pill-blue">Pending</span></div><div></div></div>`;
    const pct = Math.round(g.score / a.points * 100);
    const letter = getLetter(g.score, a.points);
    return `<div class="grades-row"><div class="grade-name">${a.icon||'📝'} ${a.title}</div><div class="grade-score">${g.score}/${a.points}</div><div><span class="grade-letter gl-${letter}">${letter}</span></div><div><span class="hero-card-pill pill-green">✅</span></div><div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><span class="progress-pct">${pct}%</span></div></div>`;
  }).join('');
  document.getElementById('myGradesContent').innerHTML = `<div class="grades-wrap"><div class="grades-head"><div>Assignment</div><div>Score</div><div>Grade</div><div>Status</div><div>Progress</div></div>${gRows}</div>`;
}

async function studentSubmit(assignmentId, title) {
  try {
    const fileName = currentUser.name.replace(/ /g, '_') + '_' + title.replace(/ /g, '_') + '.pdf';
    await db('submissions', 'POST', {
      student_name: currentUser.name,
      assignment_id: assignmentId,
      file_name: fileName
    });
    showToast('📤 Submitted: ' + title);
    renderStudentDash();
  } catch (e) {
    showToast('⚠️ Already submitted or error');
  }
}

// ---- TEACHER DASHBOARD ----
async function renderTeacherDash() {
  const assignments = cachedAssignments.length ? cachedAssignments : await db('assignments', 'GET', null, '?order=created_at.asc');
  const allSubmissions = await db('submissions', 'GET', null, '?order=submitted_at.desc');
  const allGrades = await db('grades', 'GET');
  const students = await db('students', 'GET', null, '?order=name.asc');

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card"><div class="stat-icon purple">👥</div><div><div class="stat-value">${students.length}</div><div class="stat-label">Students</div></div></div>
    <div class="stat-card"><div class="stat-icon yellow">📝</div><div><div class="stat-value">${assignments.length}</div><div class="stat-label">Assignments</div></div></div>
    <div class="stat-card"><div class="stat-icon blue">📥</div><div><div class="stat-value">${allSubmissions.length}</div><div class="stat-label">Submissions</div></div></div>
    <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${allGrades.length}</div><div class="stat-label">Grades Given</div></div></div>`;

  document.getElementById('dashTabBar').innerHTML = `
    <button class="tab-btn active" onclick="switchTab('submissions',this)">📥 Submissions</button>
    <button class="tab-btn" onclick="switchTab('gradebook',this)">📊 Grade Book</button>
    <button class="tab-btn" onclick="switchTab('manage',this)">⚙️ Manage</button>`;

  document.getElementById('pane-submissions').classList.add('active');

  // Populate assignment filter
  const sel = document.getElementById('filterAssign');
  sel.innerHTML = '<option value="">All Assignments</option>' + assignments.map(a => `<option value="${a.id}">${a.title}</option>`).join('');

  // Store for later use
  window._teacherData = { assignments, allSubmissions, allGrades, students };

  renderSubmissions();
  renderGradebook();
  renderPostedAssignments();
}

function renderSubmissions() {
  const body = document.getElementById('submissionsBody');
  if (!body || !window._teacherData) return;
  const { assignments, allSubmissions, allGrades } = window._teacherData;
  const filter = document.getElementById('filterAssign')?.value;

  const filtered = filter ? allSubmissions.filter(s => s.assignment_id === filter) : allSubmissions;

  if (!filtered.length) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No submissions yet</div></div>';
    return;
  }

  body.innerHTML = filtered.map(s => {
    const a = assignments.find(x => x.id === s.assignment_id);
    const g = allGrades.find(x => x.student_name === s.student_name && x.assignment_id === s.assignment_id);
    const initials = s.student_name.split(' ').map(w => w[0]).slice(0, 2).join('');
    const safeId = s.id.replace(/-/g, '_');
    return `<div class="sub-row">
      <div class="sub-student"><div class="sub-avatar">${initials}</div>${s.student_name}</div>
      <div class="sub-file">📎 ${a ? a.icon + ' ' + a.title : '?'}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);">${new Date(s.submitted_at).toLocaleDateString()}</div>
      <div><input type="number" class="grade-inp" id="gi_${safeId}" value="${g ? g.score : ''}" placeholder="/${a ? a.points : '?'}" min="0" max="${a ? a.points : 100}"></div>
      <div><button class="save-btn" onclick="saveGrade('${s.student_name}','${s.assignment_id}','gi_${safeId}',${a ? a.points : 100})">💾 Save</button></div>
      <div><button class="del-btn" onclick="deleteSub('${s.id}')">🗑</button></div>
    </div>`;
  }).join('');
}

async function saveGrade(studentName, assignmentId, inputId, maxPts) {
  const val = parseInt(document.getElementById(inputId)?.value);
  if (isNaN(val) || val < 0 || val > maxPts) { showToast('⚠️ Enter valid score (0–' + maxPts + ')'); return; }
  try {
    // Upsert grade
    await fetch(`${SUPABASE_URL}/rest/v1/grades`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ student_name: studentName, assignment_id: assignmentId, score: val })
    });
    showToast('✅ Grade saved for ' + studentName.split(' ')[0] + ': ' + val + '/' + maxPts);
    // Refresh teacher data
    const allGrades = await db('grades', 'GET');
    window._teacherData.allGrades = allGrades;
    renderGradebook();
  } catch (e) {
    showToast('❌ Failed to save grade');
    console.error(e);
  }
}

async function deleteSub(subId) {
  try {
    await db('submissions', 'DELETE', null, `?id=eq.${subId}`);
    showToast('🗑️ Submission deleted (grade record kept)');
    const allSubmissions = await db('submissions', 'GET', null, '?order=submitted_at.desc');
    window._teacherData.allSubmissions = allSubmissions;
    renderSubmissions();
  } catch (e) {
    showToast('❌ Failed to delete');
  }
}

function renderGradebook() {
  const body = document.getElementById('gradebookBody');
  if (!body || !window._teacherData) return;
  const { assignments, allGrades, students } = window._teacherData;

  body.innerHTML = students.map(s => {
    const scores = assignments.slice(0, 3).map(a => {
      const g = allGrades.find(x => x.student_name === s.name && x.assignment_id === a.id);
      return g ? `<div><span class="grade-letter gl-${getLetter(g.score, a.points)}">${g.score}</span></div>` : '<div style="color:var(--text-muted)">—</div>';
    }).join('');
    const sGrades = allGrades.filter(g => g.student_name === s.name);
    const avg = sGrades.length
      ? Math.round(sGrades.reduce((sum, g) => {
          const a = assignments.find(x => x.id === g.assignment_id);
          return sum + (a ? g.score / a.points * 100 : 0);
        }, 0) / sGrades.length)
      : null;
    const initials = s.name.split(' ').map(w => w[0]).slice(0, 2).join('');
    return `<div class="grades-row" style="grid-template-columns:2fr 1fr 1fr 1fr 1.5fr;">
      <div class="sub-student"><div class="sub-avatar">${initials}</div>${s.name}</div>
      ${scores}
      <div>${avg !== null ? `<span class="grade-letter gl-${avg>=90?'A':avg>=75?'B':'C'}">${avg}%</span>` : '—'}</div>
    </div>`;
  }).join('');
}

function renderPostedAssignments() {
  const el = document.getElementById('postedAssignments');
  if (!el || !window._teacherData) return;
  const { assignments, allSubmissions } = window._teacherData;
  el.innerHTML = assignments.map(a => {
    const subCount = allSubmissions.filter(s => s.assignment_id === a.id).length;
    return `<div class="posted-assign-item">
      <div><div class="pa-title">${a.icon||'📝'} ${a.title}</div><div class="pa-meta">Due: ${a.due_date} · ${a.points} pts · ${subCount} submissions</div></div>
      <button class="del-btn" onclick="removeAssignment('${a.id}')">🗑 Remove</button>
    </div>`;
  }).join('');
}

async function addAssignment() {
  const title = document.getElementById('newTitle').value.trim();
  const due = document.getElementById('newDue').value;
  const desc = document.getElementById('newDesc').value.trim();
  const points = parseInt(document.getElementById('newPoints').value) || 30;
  if (!title || !due) { showToast('⚠️ Please fill in title and due date'); return; }

  const icons = ['📝','📊','📄','🔧','📋','✍️','🎯','📈'];
  try {
    const newA = await db('assignments', 'POST', {
      title, description: desc || 'Complete as per class instructions.',
      due_date: due, points,
      icon: icons[Math.floor(Math.random() * icons.length)]
    });
    cachedAssignments = await db('assignments', 'GET', null, '?order=created_at.asc');
    window._teacherData.assignments = cachedAssignments;
    document.getElementById('newTitle').value = '';
    document.getElementById('newDue').value = '';
    document.getElementById('newDesc').value = '';
    showToast('🚀 Assignment posted: ' + title);
    renderPostedAssignments();
    updateHeroStats();
  } catch (e) {
    showToast('❌ Failed to post assignment');
    console.error(e);
  }
}

async function removeAssignment(id) {
  try {
    await db('assignments', 'DELETE', null, `?id=eq.${id}`);
    cachedAssignments = await db('assignments', 'GET', null, '?order=created_at.asc');
    window._teacherData.assignments = cachedAssignments;
    showToast('🗑️ Assignment removed');
    renderPostedAssignments();
    updateHeroStats();
  } catch (e) {
    showToast('❌ Failed to remove');
  }
}

// ============================================================
// TABS
// ============================================================
function switchTab(id, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('pane-' + id).classList.add('active');
}

// ============================================================
// HELPERS
// ============================================================
function getLetter(score, max) {
  const p = (score / max) * 100;
  return p >= 90 ? 'A' : p >= 75 ? 'B' : p >= 60 ? 'C' : 'F';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}
