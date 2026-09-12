(function(){
  const NAV_ITEMS = [
    { section: 'Workspace' },
    { href: '/sales/', label: 'Dashboard' },
    { href: '/sales/leads/', label: 'Leads' },
    { href: '/sales/pipeline/', label: 'Pipeline' },
    { href: '/sales/followups/', label: 'Follow-ups' },
    { href: '/sales/templates/', label: 'Templates' },
    { href: '/sales/reports/', label: 'Reports' },
    { href: '/sales/reminders/', label: 'Reminders' },
    { section: 'Outreach' },
    { href: '/sales/outreach/', label: 'Outreach' },
    { href: '/sales/outreach/review/', label: 'Review' },
    { href: '/sales/outreach/queue/', label: 'Send Queue' },
    { section: 'History' },
    { href: '/sales/activity/', label: 'Activity' }
  ];

  function normalize(path){
    if(!path) return '/';
    return path.endsWith('/') ? path : path + '/';
  }

  function isActive(href, current){
    const a = normalize(href);
    const c = normalize(current);
    if(a === '/sales/' && c === '/sales/') return true;
    if(a !== '/sales/' && c.startsWith(a)) return true;
    return false;
  }

  function renderDesktop(current){
    return `
      <div class="brand">
        <h1>Aneeverse Sales</h1>
        <p>Simple outbound workspace focused on revenue and follow-through.</p>
      </div>
      <nav class="nav">
        ${NAV_ITEMS.map(item => item.section
          ? `<div class="nav-label">${item.section}</div>`
          : `<a href="${item.href}" class="${isActive(item.href,current)?'active':''}">${item.label}</a>`).join('')}
      </nav>
    `;
  }

  function renderMobile(current){
    return NAV_ITEMS.filter(item => item.href).map(item =>
      `<a href="${item.href}" class="${isActive(item.href,current)?'active':''}">${item.label}</a>`
    ).join('');
  }

  document.addEventListener('DOMContentLoaded', function(){
    const current = window.location.pathname;
    const desktop = document.getElementById('sales-sidebar-nav');
    const mobile = document.getElementById('sales-mobile-nav');
    if(desktop) desktop.innerHTML = renderDesktop(current);
    if(mobile) mobile.innerHTML = renderMobile(current);
  });
})();
