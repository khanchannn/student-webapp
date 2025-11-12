(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const toast = (message, variant = 'success') => {
    const container = document.querySelector('#toastContainer') || (() => {
      const div = document.createElement('div');
      div.id = 'toastContainer';
      div.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(div);
      return div;
    })();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="toast align-items-center text-bg-${variant} border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>`;
    const el = wrapper.firstElementChild;
    container.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 2500 });
    t.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  };

  const initIndex = () => {
    if (!$('#studentsTable')) return;

    const state = {
      sortBy: 'id',
      order: 'asc',
      search: '',
      branch: '',
      semester: ''
    };

    const setLoading = (on) => {
      const el = $('#loading');
      if (!el) return;
      el.classList.toggle('d-none', !on);
    };

    const buildQuery = () => {
      const p = new URLSearchParams();
      if (state.search) p.set('search', state.search);
      if (state.branch) p.set('branch', state.branch);
      if (state.semester) p.set('semester', state.semester);
      p.set('sortBy', state.sortBy);
      p.set('order', state.order);
      return p.toString();
    };

    const fetchStudents = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/students?${buildQuery()}`);
        const data = await res.json();
        renderRows(data);

        const r = $('#reflect');
        if (state.search) {
          r.classList.remove('d-none');
          r.textContent = `Kết quả cho: ${state.search}`;
        } else {
          r.classList.add('d-none');
          r.textContent = '';
        }
      } catch (e) {
        console.error('fetchStudents error', e);
        toast('Không thể tải danh sách sinh viên', 'danger');
      } finally {
        setLoading(false);
      }
    };

    const renderRows = (rows) => {
      const tbody = $('#studentsTable tbody');
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Không có dữ liệu</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.dataset.id = String(r.id);

        const idTd = document.createElement('td');
        idTd.textContent = r.id;

        const nameTd = document.createElement('td');
        nameTd.textContent = r.name;

        const branchTd = document.createElement('td');
        const span = document.createElement('span');
        span.className = 'badge text-bg-secondary';
        span.textContent = r.branch;
        branchTd.appendChild(span);

        const semesterTd = document.createElement('td');
        semesterTd.textContent = r.semester;

        const actionTd = document.createElement('td');
        actionTd.className = 'text-end';
        actionTd.innerHTML = `
          <button type="button" class="btn btn-sm btn-outline-primary me-2 edit-btn"><i class="bi bi-pencil-square"></i> Edit</button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-btn"><i class="bi bi-trash"></i> Delete</button>
        `;

        tr.append(idTd, nameTd, branchTd, semesterTd, actionTd);
        tbody.appendChild(tr);
      });
    };

    const openModal = (mode, record = null) => {
      $('#modalTitle').textContent = mode === 'create' ? 'Thêm sinh viên' : 'Chỉnh sửa sinh viên';
      $('#studentId').value = record?.id ?? '';
      $('#nameInput').value = record?.name ?? '';
      $('#branchInput').value = record?.branch ?? '';
      $('#semesterInput').value = record?.semester ?? '';
      const modal = new bootstrap.Modal('#studentModal');
      modal.show();
    };

    const resetForm = () => {
      $('#studentForm').reset();
      $('#studentId').value = '';
    };

    const submitForm = async (e) => {
      e.preventDefault();
      const id = $('#studentId').value;
      const payload = {
        name: $('#nameInput').value,
        branch: $('#branchInput').value,
        semester: $('#semesterInput').value
      };
      try {
        setLoading(true);
        const res = await fetch(id ? `/students/${id}` : '/students', {
          method: id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
        toast(id ? 'Đã cập nhật sinh viên' : 'Đã thêm sinh viên', 'success');
        bootstrap.Modal.getInstance($('#studentModal')).hide();
        resetForm();
        fetchStudents();
      } catch (err) {
        toast('Có lỗi xảy ra khi lưu dữ liệu', 'danger');
      } finally {
        setLoading(false);
      }
    };

    const handleTableClick = async (e) => {
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      const id = row.dataset.id;

      if (e.target.closest('.edit-btn')) {
        const tds = row.querySelectorAll('td');
        openModal('edit', {
          id,
          name: tds[1].textContent.trim(),
          branch: tds[2].innerText.trim(),
          semester: tds[3].textContent.trim()
        });
      } else if (e.target.closest('.delete-btn')) {
        if (!confirm('Xoá sinh viên này?')) return;
        try {
          setLoading(true);
          const res = await fetch(`/students/${encodeURIComponent(id)}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
          toast('Đã xoá sinh viên', 'success');
          fetchStudents();
        } catch (err) {
          console.error('delete error', err);
          toast('Xoá thất bại', 'danger');
        } finally {
          setLoading(false);
        }
      }
    };

    const setupSorting = () => {
      $$('#studentsTable thead th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const k = th.dataset.sort;
          if (state.sortBy === k) {
            state.order = state.order === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortBy = k;
            state.order = 'asc';
          }
          fetchStudents();
        });
      });
    };

    const debounce = (fn, ms = 350) => {
      let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    };

    $('#addBtn').addEventListener('click', () => openModal('create'));
    $('#studentForm').addEventListener('submit', submitForm);
    $('#studentsTable').addEventListener('click', handleTableClick);
    $('#branchFilter').addEventListener('change', () => { state.branch = $('#branchFilter').value; fetchStudents(); });
    $('#semesterFilter').addEventListener('change', () => { state.semester = $('#semesterFilter').value; fetchStudents(); });
    $('#searchInput').addEventListener('input', debounce(() => { state.search = $('#searchInput').value; fetchStudents(); }));

    setupSorting();
    fetchStudents();
  };

  const initLogin = () => {
    const form = document.querySelector('#loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const msg = $('#msg');
      if (res.ok) {
        msg.className = 'alert alert-success';
        msg.textContent = 'Đăng nhập thành công! Chuyển về trang chủ...';
        setTimeout(() => location.href = '/', 800);
      } else {
        msg.className = 'alert alert-danger';
        msg.textContent = 'Sai username/password (hoặc DB lỗi).';
      }
      msg.classList.remove('d-none');
    });
  };

  const initUpload = () => {
    const form = $('#uploadForm');
    if (!form) return;
    const msg = $('#uploadMsg');
    const list = $('#fileList');

    const loadFiles = async () => {
      const res = await fetch('/files');
      const data = await res.json();
      list.innerHTML = data.map(f =>
        `<li class="list-group-item d-flex justify-content-between align-items-center">
          <span>${f}</span>
          <a class="btn btn-sm btn-outline-secondary" href="/uploads/${encodeURIComponent(f)}" target="_blank">Tải</a>
        </li>`
      ).join('');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const res = await fetch('/upload', { method: 'POST', body: fd });
      if (res.ok) {
        msg.className = 'alert alert-success';
        msg.textContent = 'Upload thành công';
        form.reset();
        loadFiles();
      } else {
        msg.className = 'alert alert-danger';
        msg.textContent = 'Upload thất bại';
      }
      msg.classList.remove('d-none');
    });

    loadFiles();
  };

  document.addEventListener('DOMContentLoaded', () => {
    try { initIndex(); } catch {}
    try { initLogin(); } catch {}
    try { initUpload(); } catch {}
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      document.cookie = 'auth=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      location.href = '/login.html';
    });
  }
});
