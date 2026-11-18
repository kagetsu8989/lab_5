'use strict';

const $ = (id) => document.getElementById(id);
const API = '/api';
const state = {
  user: null,
  token: null, // Зөвхөн memory-д; localStorage-д хадгалахгүй
  items: [],
  category: 'all',
  screen: 'all',
  createKind: 'lost',
  pendingCreateKind: null,
  search: '',
  resetToken: new URLSearchParams(location.search).get('reset') || ''
};

async function apiRequest(path, method = 'GET', body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(data.missing_fields)
      ? ` (${data.missing_fields.join(', ')})`
      : '';
    throw new Error((data.message || `HTTP ${response.status}`) + details);
  }
  return data;
}

function setMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle('success', success);
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

function switchAuthView(view) {
  for (const name of ['login', 'register', 'forgot', 'reset']) {
    $(`${name}View`).hidden = name !== view;
  }
  $('authMessage').textContent = '';
  $('devResetLink').hidden = true;
  $('authOverlay').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    $(`${view}View`).querySelector('input')?.focus();
  }, 0);
}

function closeAuth() {
  $('authOverlay').hidden = true;
  document.body.style.overflow = '';
}

function applyLogin(data) {
  if (!data.token || !data.user || !Number.isSafeInteger(Number(data.user.user_id))) {
    throw new Error('Серверээс нэвтрэх мэдээлэл бүрэн ирсэнгүй.');
  }
  state.token = data.token;
  state.user = data.user;
  $('accountLabel').textContent = data.user.name || data.user.email || 'Хэрэглэгч';
  $('logoutButton').hidden = false;
  closeAuth();
  updateStats();
  renderItems();
  // Нэвтрэхээс өмнө "олсон/гээсэн бүртгэх" дарсан бол тэр формыг нээнэ.
  if (state.pendingCreateKind) {
    const kind = state.pendingCreateKind;
    state.pendingCreateKind = null;
    openCreatePanel(kind);
  }
}

$('topLogin').addEventListener('click', () => {
  if (state.user) setScreen('mine');
  else switchAuthView('login');
});
$('logoutButton').addEventListener('click', () => {
  state.token = null;
  state.user = null;
  state.pendingCreateKind = null;
  $('accountLabel').textContent = 'Нэвтрэх';
  $('logoutButton').hidden = true;
  $('createPanel').hidden = true;
  setScreen('all');
  updateStats();
});
$('closeAuth').addEventListener('click', closeAuth);
$('authOverlay').addEventListener('click', (event) => {
  if (event.target === $('authOverlay')) closeAuth();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('authOverlay').hidden) closeAuth();
});
$('registerTrigger').addEventListener('click', () => switchAuthView('register'));
$('forgotTrigger').addEventListener('click', () => switchAuthView('forgot'));
for (const button of document.querySelectorAll('[data-go]')) {
  button.addEventListener('click', () => switchAuthView(button.dataset.go));
}

// Нэвтрэх
$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  setBusy($('loginSubmit'), true);
  setMessage($('authMessage'), 'Нэвтэрч байна...');
  try {
    const data = await apiRequest('/auth/login', 'POST', { email, password });
    applyLogin(data);
    $('loginPassword').value = '';
  } catch (error) {
    setMessage($('authMessage'), error.message);
  } finally {
    setBusy($('loginSubmit'), false);
  }
});

// Шинээр бүртгүүлэх: одоо байгаа /api/auth/register route
$('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('registerName').value.trim();
  const email = $('registerEmail').value.trim();
  const password = $('registerPassword').value;
  const confirm = $('registerConfirm').value;

  if (password.length < 12) return setMessage($('authMessage'), 'Нууц үг дор хаяж 12 тэмдэгттэй байх ёстой.');
  if (password !== confirm) return setMessage($('authMessage'), 'Давтан оруулсан нууц үг тохирохгүй байна.');

  setBusy($('registerSubmit'), true);
  setMessage($('authMessage'), 'Бүртгэл үүсгэж байна...');
  try {
    await apiRequest('/auth/register', 'POST', { name, email, password });
    // Бүртгэл амжилттай бол шууд нэвтрэнэ.
    const loginData = await apiRequest('/auth/login', 'POST', { email, password });
    applyLogin(loginData);
    $('registerForm').reset();
  } catch (error) {
    setMessage($('authMessage'), error.message);
  } finally {
    setBusy($('registerSubmit'), false);
  }
});

// Сэргээх холбоос хүсэх
$('forgotForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('forgotEmail').value.trim();
  setBusy($('forgotSubmit'), true);
  setMessage($('authMessage'), 'Хүсэлтийг боловсруулж байна...');
  $('devResetLink').hidden = true;
  try {
    const data = await apiRequest('/auth/forgot-password', 'POST', { email });
    setMessage($('authMessage'), data.message || 'Бүртгэлтэй имэйл бол холбоос илгээгдэнэ.', true);
    if (data.dev_reset_url) {
      const box = $('devResetLink');
      box.replaceChildren(document.createTextNode('Локал тестийн сэргээх холбоос: '));
      const link = document.createElement('a');
      link.href = data.dev_reset_url;
      link.textContent = 'Нууц үг шинэчлэх';
      box.append(link);
      box.hidden = false;
    }
  } catch (error) {
    setMessage($('authMessage'), error.message);
  } finally {
    setBusy($('forgotSubmit'), false);
  }
});

// Шинэ нууц үг хадгалах
$('resetForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = $('resetPassword').value;
  if (password.length < 12) return setMessage($('authMessage'), 'Хамгийн багадаа 12 тэмдэгт оруулна уу.');
  if (password !== $('resetConfirm').value) return setMessage($('authMessage'), 'Нууц үгүүд хоорондоо тохирохгүй байна.');
  if (!state.resetToken) return setMessage($('authMessage'), 'Сэргээх холбоос байхгүй байна.');

  setBusy($('resetSubmit'), true);
  try {
    const data = await apiRequest('/auth/reset-password', 'POST', {
      token: state.resetToken,
      password
    });
    state.resetToken = '';
    history.replaceState(null, '', '/ui/');
    $('resetForm').reset();
    switchAuthView('login');
    setMessage($('authMessage'), data.message || 'Нууц үг шинэчлэгдлээ. Одоо нэвтэрнэ үү.', true);
  } catch (error) {
    setMessage($('authMessage'), error.message);
  } finally {
    setBusy($('resetSubmit'), false);
  }
});

function setScreen(screen) {
  if (screen === 'mine' && !state.user) {
    switchAuthView('login');
    return;
  }
  state.screen = screen;
  const titles = {
    all: 'Сүүлийн бүртгэлүүд',
    mine: 'Миний бүртгэлүүд',
    lost: 'Гээсэн эд зүйлс',
    found: 'Олдсон эд зүйлс'
  };
  $('listTitle').textContent = titles[screen] || titles.all;
  state.category = (screen === 'lost' || screen === 'found') ? screen : 'all';
  for (const tab of document.querySelectorAll('[data-type]')) {
    tab.classList.toggle('active', tab.dataset.type === state.category);
  }
  for (const nav of document.querySelectorAll('[data-nav]')) {
    nav.classList.toggle('active', nav.dataset.nav === screen);
  }
  $('sidebar').classList.remove('open');
  renderItems();
  $('listingPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
for (const nav of document.querySelectorAll('[data-nav]')) {
  nav.addEventListener('click', () => setScreen(nav.dataset.nav));
}
$('menuButton').addEventListener('click', () => $('sidebar').classList.toggle('open'));

function setCreateKind(kind) {
  if (kind !== 'lost' && kind !== 'found') return;
  state.createKind = kind;
  const found = kind === 'found';

  $('createKicker').textContent = found ? 'ОЛСОН ЭД ЗҮЙЛ' : 'ГЭЭСЭН ЭД ЗҮЙЛ';
  $('createHeading').textContent = found ? 'Олсон эд зүйл бүртгэх' : 'Гээсэн эд зүйл бүртгэх';
  $('createDescription').textContent = found
    ? 'Олсон эд зүйлийн мэдээллийг бүртгэж, эзэнд нь эргүүлэн олгоход туслаарай.'
    : 'Гээсэн эд зүйлийн мэдээллийг үнэн зөв оруулснаар олоход илүү хялбар.';
  $('itemDateLabel').textContent = found ? 'Олсон огноо *' : 'Алдсан огноо *';
  $('itemLocationLabel').textContent = found ? 'Олсон байршил *' : 'Алдсан байршил *';
  $('itemLocation').placeholder = found
    ? 'Жишээ: Сүхбаатарын талбайн ойролцоо'
    : 'Жишээ: МУИС, номын сан';
  $('createSubmit').firstChild.textContent = found ? 'Олсон зүйл бүртгэх ' : 'Гээсэн зүйл бүртгэх ';
  for (const button of document.querySelectorAll('[data-create-kind]')) {
    const selected = button.dataset.createKind === kind;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  setMessage($('itemMessage'), '');
}

function openCreatePanel(kind = 'lost') {
  if (!state.user) {
    state.pendingCreateKind = kind;
    return switchAuthView('login');
  }
  setCreateKind(kind);
  $('createPanel').hidden = false;
  $('sidebar').classList.remove('open');
  $('createPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('itemName').focus();
}
$('heroCreate').addEventListener('click', () => openCreatePanel('lost'));
$('heroCreateFound').addEventListener('click', () => openCreatePanel('found'));
$('sideCreate').addEventListener('click', () => openCreatePanel('lost'));
$('sideCreateFound').addEventListener('click', () => openCreatePanel('found'));
for (const button of document.querySelectorAll('[data-create-kind]')) {
  button.addEventListener('click', () => setCreateKind(button.dataset.createKind));
}
$('closeCreate').addEventListener('click', () => { $('createPanel').hidden = true; });
$('itemForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.user) return switchAuthView('login');
  const found = state.createKind === 'found';
  const body = {
    user_id: state.user.user_id,
    item_name: $('itemName').value.trim(),
    category: $('category').value,
    description: $('description').value.trim(),
    [found ? 'found_date' : 'lost_date']: $('itemDate').value,
    [found ? 'found_location' : 'lost_location']: $('itemLocation').value.trim()
  };
  setBusy($('createSubmit'), true);
  setMessage($('itemMessage'), 'Хадгалж байна...');
  try {
    const result = await apiRequest(found ? '/found-items' : '/lost-items', 'POST', body);
    setMessage($('itemMessage'), `Амжилттай бүртгэгдлээ! №${result.item_id}`, true);
    $('itemForm').reset();
    // Бүртгэсэн төрөлдөө тохирох огноог буцааж тохируулах
    $('itemDate').value = localDateString(new Date());
    await loadItems();
    setScreen(found ? 'found' : 'lost');
  } catch (error) {
    setMessage($('itemMessage'), error.message);
  } finally {
    setBusy($('createSubmit'), false);
  }
});

function normalize(item, kind) {
  return {
    id: item.item_id,
    userId: Number(item.user_id),
    name: String(item.item_name || 'Нэргүй эд зүйл'),
    category: String(item.category || 'Бусад'),
    description: String(item.description || ''),
    location: String(kind === 'lost' ? item.lost_location || '' : item.found_location || ''),
    date: String(kind === 'lost' ? item.lost_date || '' : item.found_date || '').slice(0, 10),
    owner: String(item.registered_by || item.name || 'Хэрэглэгч'),
    kind,
    createdAt: item.created_at || ''
  };
}

async function loadItems() {
  $('listMessage').textContent = 'Бүртгэлүүдийг ачаалж байна...';
  const [lost, found] = await Promise.allSettled([
    apiRequest('/lost-items'),
    apiRequest('/found-items')
  ]);
  const items = [];
  if (lost.status === 'fulfilled') {
    for (const row of (Array.isArray(lost.value.data) ? lost.value.data : [])) {
      items.push(normalize(row, 'lost'));
    }
  }
  if (found.status === 'fulfilled') {
    for (const row of (Array.isArray(found.value.data) ? found.value.data : [])) {
      items.push(normalize(row, 'found'));
    }
  }
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  state.items = items;
  if (lost.status === 'rejected' && found.status === 'rejected') {
    $('listMessage').textContent = 'API холболт амжилтгүй боллоо. Серверээ шалгана уу.';
  } else if (lost.status === 'rejected' || found.status === 'rejected') {
    $('listMessage').textContent = 'Зарим төрлийн мэдээлэл ачаалагдсангүй.';
  } else {
    $('listMessage').textContent = '';
  }
  updateStats(lost.status === 'fulfilled', found.status === 'fulfilled');
  renderItems();
}

function updateStats(lostOK = true, foundOK = true) {
  const lost = state.items.filter(item => item.kind === 'lost').length;
  const found = state.items.filter(item => item.kind === 'found').length;
  $('statTotal').textContent = (lostOK && foundOK) ? String(lost + found) : '—';
  $('statLost').textContent = lostOK ? String(lost) : '—';
  $('statFound').textContent = foundOK ? String(found) : '—';
  $('statMine').textContent = state.user
    ? String(state.items.filter(item => item.userId === Number(state.user.user_id)).length)
    : '—';
}

const symbolForCategory = (category) => {
  if (/цахилгаан|утас|компьютер/i.test(category)) return '📱';
  if (/түлхүүр/i.test(category)) return '🔑';
  if (/цүнх/i.test(category)) return '🎒';
  if (/бичиг|баримт/i.test(category)) return '📄';
  return '📦';
};
function iconElement(symbol) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${symbol}`);
  svg.append(use);
  return svg;
}
function metaLine(icon, value) {
  const row = document.createElement('span');
  row.append(iconElement(icon), document.createTextNode(value));
  return row;
}
function itemCard(item) {
  const card = document.createElement('article');
  card.className = 'item-card';
  const head = document.createElement('div');
  head.className = 'item-card-head';
  const emblem = document.createElement('div');
  emblem.className = 'item-emblem';
  emblem.textContent = symbolForCategory(item.category);
  const badge = document.createElement('span');
  badge.className = `status-badge${item.kind === 'found' ? ' found' : ''}`;
  badge.textContent = item.kind === 'lost' ? 'ГЭЭСЭН' : 'ОЛДСОН';
  head.append(emblem, badge);
  const title = document.createElement('h3');
  title.textContent = item.name;
  const description = document.createElement('p');
  description.className = 'item-description';
  description.textContent = item.description.length > 110 ? `${item.description.slice(0, 110)}…` : item.description;
  const meta = document.createElement('div');
  meta.className = 'item-meta';
  meta.append(metaLine('pin', item.location || 'Байршил бүртгэгдээгүй'), metaLine('calendar', item.date || 'Огноо тодорхойгүй'));
  const bottom = document.createElement('div');
  bottom.className = 'item-bottom';
  const owner = document.createElement('span');
  owner.textContent = item.owner;
  const identifier = document.createElement('span');
  identifier.textContent = `#${item.id}`;
  bottom.append(owner, identifier);
  card.append(head, title, description, meta, bottom);
  return card;
}
function renderItems() {
  const search = state.search.toLocaleLowerCase('mn-MN');
  const visible = state.items.filter((item) => {
    if (state.screen === 'mine' && item.userId !== Number(state.user?.user_id)) return false;
    if (state.category !== 'all' && item.kind !== state.category) return false;
    return [item.name, item.category, item.location, item.description]
      .some(text => text.toLocaleLowerCase('mn-MN').includes(search));
  });
  const grid = $('itemsGrid');
  grid.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const emoji = document.createElement('div');
    emoji.className = 'empty-emoji';
    emoji.textContent = '🔎';
    const heading = document.createElement('h3');
    heading.textContent = 'Бүртгэл олдсонгүй';
    const note = document.createElement('p');
    note.textContent = 'Хайх үгээ өөрчилж эсвэл шинэ бүртгэл үүсгээрэй.';
    empty.append(emoji, heading, note);
    grid.append(empty);
    return;
  }
  for (const item of visible) grid.append(itemCard(item));
}
for (const tab of document.querySelectorAll('[data-type]')) {
  tab.addEventListener('click', () => {
    state.category = tab.dataset.type;
    if (state.screen !== 'mine') {
      state.screen = state.category === 'all' ? 'all' : state.category;
      for (const nav of document.querySelectorAll('[data-nav]')) {
        nav.classList.toggle('active', nav.dataset.nav === state.screen);
      }
    }
    document.querySelectorAll('[data-type]').forEach(button => button.classList.toggle('active', button === tab));
    renderItems();
  });
}
$('searchInput').addEventListener('input', (event) => {
  state.search = event.target.value.trim();
  renderItems();
});
$('refreshButton').addEventListener('click', loadItems);

const now = new Date();
$('todayLabel').textContent = now.toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' });
function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
$('itemDate').value = localDateString(now);
loadItems();
if (state.resetToken) switchAuthView('reset');
