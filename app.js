const APP_VERSION = "3.10";
const APP_BUILD = "20260701-006";

const PEOPLE = [
  {id:"andre", name:"André"},
  {id:"daniel", name:"Daniel"},
  {id:"hans", name:"Hans"},
  {id:"juergen", name:"Jürgen"},
  {id:"tilmann", name:"Tilmann"}
];

const STORAGE_KEY = "ritter_kasse_v1_data";
let state = loadState();
let view = "start";
let previousView = null;
let historyStack = [];
let selectedVentureId = state.ventures[0]?.id || null;
let ventureTab = "expenses";
let editingExpenseId = null;
let isDirty = false;
let pendingNavigation = null;

function uid(prefix){ return prefix + "_" + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); }
function today(){ return new Date().toISOString().slice(0,10); }
function fmtDate(d){ if(!d) return ""; const [y,m,day]=d.split("-"); return `${day}.${m}.${y}`; }
function fmtDateRange(v){ return v.endDate ? `${fmtDate(v.startDate)}–${fmtDate(v.endDate)}` : fmtDate(v.startDate); }
function toCents(value){
  return Math.round((Number(value) || 0) * 100);
}
function fromCents(cents){
  return cents / 100;
}
function fmtEUR(n){
  return (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("de-DE",{style:"currency",currency:"EUR"});
}
function fmtEURFromCents(cents){
  return (cents / 100).toLocaleString("de-DE",{style:"currency",currency:"EUR"});
}
function parseAmountToCents(s){
  const raw = String(s ?? "").trim();
  if(!raw) return NaN;

  let cleaned = raw
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .trim();

  // Genau ein optionales Dezimaltrennzeichen, Komma oder Punkt; keine negativen Beträge.
  if(!/^\d+([,.]\d{0,2})?$/.test(cleaned)) return NaN;

  const parts = cleaned.replace(",", ".").split(".");
  const euros = Number(parts[0]);
  const centsPart = (parts[1] || "").padEnd(2, "0");
  const cents = Number(centsPart || "0");

  if(!Number.isInteger(euros) || !Number.isInteger(cents)) return NaN;
  return euros * 100 + cents;
}
function parseAmount(s){
  const cents = parseAmountToCents(s);
  return Number.isNaN(cents) ? NaN : cents / 100;
}
function personName(id){ return PEOPLE.find(p=>p.id===id)?.name || id; }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.style.display="block"; setTimeout(()=>t.style.display="none",1800); }

function markDirty(){ isDirty = true; }
function clearDirty(){ isDirty = false; }

function isEditableView(){
  return ["newVenture","expenseForm","paymentForm"].includes(view);
}

function attemptLeave(action){
  if(isDirty && isEditableView()){
    pendingNavigation = action;
    document.getElementById("dirtyModal").style.display = "flex";
    return;
  }
  action();
}

function hideDirtyModal(){
  document.getElementById("dirtyModal").style.display = "none";
}

function dirtyModalCancel(){
  pendingNavigation = null;
  hideDirtyModal();
}

function dirtyModalDiscard(){
  clearDirty();
  const action = pendingNavigation;
  pendingNavigation = null;
  hideDirtyModal();
  if(action) action();
}

function dirtyModalSave(){
  let ok = true;
  if(view === "newVenture") ok = createVenture(true);
  else if(view === "expenseForm") ok = saveExpense(true);
  else if(view === "paymentForm") ok = savePayment(true);
  if(!ok) return;
  const action = pendingNavigation;
  pendingNavigation = null;
  hideDirtyModal();
  clearDirty();
  if(action) action();
}

function demoState(){
  const v1 = {id:uid("u"), name:"Rittertreffen am Brettmühlenteich", startDate:"2026-06-26", endDate:"", status:"open", createdBy:"juergen", archived:false, participants:["andre","daniel","hans","juergen","tilmann"], createdAt:new Date().toISOString()};
  const v2 = {id:uid("u"), name:"Tilmanns epische Tafelrunde", startDate:"2026-06-21", endDate:"2026-06-23", status:"open", createdBy:"tilmann", archived:false, participants:["andre","daniel","juergen","tilmann"], createdAt:new Date().toISOString()};
  const v3 = {id:uid("u"), name:"Weihnachtsmarkt 2025", startDate:"2025-12-12", endDate:"", status:"closed", createdBy:"andre", archived:true, participants:["andre","daniel","hans","juergen","tilmann"], createdAt:new Date().toISOString()};
  return {
    ventures:[v1,v2,v3],
    expenses:[
      {id:uid("a"), ventureId:v1.id, desc:"Pizza", amount:86.50, paidBy:"andre", date:"2026-06-26", participantIds:null},
      {id:uid("a"), ventureId:v1.id, desc:"Parkgebühren", amount:32.00, paidBy:"juergen", date:"2026-06-26", participantIds:["andre","juergen","tilmann"]},
      {id:uid("a"), ventureId:v2.id, desc:"Grillgut", amount:72.30, paidBy:"tilmann", date:"2026-06-21", participantIds:null},
      {id:uid("a"), ventureId:v2.id, desc:"Getränke", amount:64.00, paidBy:"andre", date:"2026-06-22", participantIds:null}
    ],
    payments:[]
  }
}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return demoState();
}

function ventureExpenses(ventureId){ return state.expenses.filter(e=>e.ventureId===ventureId); }
function venturePayments(ventureId){ return state.payments.filter(p=>!p.ventureId || p.ventureId===ventureId); }
function expenseParticipants(e){
  const v=state.ventures.find(x=>x.id===e.ventureId);
  return e.participantIds && e.participantIds.length ? e.participantIds : (v?.participants || []);
}
function expenseSplitCents(e){
  const participants = expenseParticipants(e);
  if(!participants.length) return [];
  const amountCents = toCents(e.amount);
  const baseShare = Math.floor(amountCents / participants.length);
  let rest = amountCents - baseShare * participants.length;

  const canonical = [...participants].sort((a,b)=>
    PEOPLE.findIndex(p=>p.id===a) - PEOPLE.findIndex(p=>p.id===b)
  );

  // Faire Rotation: Restcent starten bei einem ausgabeabhängigen Index.
  // Dadurch bekommen nicht immer dieselben Personen den Extra-Cent.
  let seed = 0;
  for(const ch of String(e.id || e.desc || "")) seed += ch.charCodeAt(0);
  const start = canonical.length ? seed % canonical.length : 0;
  const ordered = canonical.slice(start).concat(canonical.slice(0,start));

  const extras = Object.fromEntries(participants.map(pid=>[pid,0]));
  for(const pid of ordered){
    if(rest <= 0) break;
    extras[pid] = 1;
    rest--;
  }

  return canonical.map(pid=>({
    personId: pid,
    cents: baseShare + extras[pid],
    extraCent: extras[pid] === 1
  }));
}

function hasRestCents(e){
  const participants = expenseParticipants(e);
  if(!participants.length) return false;
  return toCents(e.amount) % participants.length !== 0;
}

function splitExplanationHtml(e){
  const participants = expenseParticipants(e);
  if(!participants.length) return "";

  const amountCents = toCents(e.amount);
  const rest = amountCents % participants.length;
  if(rest === 0) return "";

  return `<div class="info-note">ℹ️ Der Betrag lässt sich nicht centgenau gleichmäßig auf ${participants.length} Personen verteilen. Die App verteilt die verbleibenden ${rest} Cent automatisch auf einzelne Beteiligte, damit die Gesamtsumme exakt dem Rechnungsbetrag entspricht.</div>`;
}

function splitWarningHtml(amountCents, participantCount){
  if(!Number.isFinite(amountCents) || amountCents <= 0 || !participantCount) return "";
  const rest = amountCents % participantCount;
  if(rest === 0) return "";
  return `ℹ️ Der Betrag lässt sich nicht centgenau gleichmäßig auf ${participantCount} Personen verteilen. Die App verteilt die verbleibenden ${rest} Cent automatisch auf einzelne Beteiligte, damit die Gesamtsumme exakt dem Rechnungsbetrag entspricht.`;
}

function currentExpenseParticipantIdsForForm(){
  const customBox = document.getElementById("splitCustomBox");
  const ventureSelect = document.getElementById("eVenture");
  const v = state.ventures.find(x => x.id === ventureSelect?.value) || state.ventures.find(x => x.id === selectedVentureId);
  if(customBox && customBox.classList.contains("checked")){
    return getTogglePeople("ep_");
  }
  return v?.participants || [];
}

function updateExpenseSplitHint(){
  const hint = document.getElementById("liveSplitHint");
  const amountInput = document.getElementById("eAmount");
  if(!hint || !amountInput) return;

  const amountCents = parseAmountToCents(amountInput.value);
  const participantIds = currentExpenseParticipantIdsForForm();
  const text = splitWarningHtml(amountCents, participantIds.length);

  if(text){
    hint.textContent = text;
    hint.classList.remove("hidden");
  }else{
    hint.textContent = "";
    hint.classList.add("hidden");
  }
}

function computeBalances(ventureId=null){
  // Alle Salden werden intern exakt in Cent als Ganzzahlen berechnet.
  const balances = Object.fromEntries(PEOPLE.map(p=>[p.id,0]));
  const expenses = ventureId ? state.expenses.filter(e=>e.ventureId===ventureId) : state.expenses.filter(e=>{
    const v=state.ventures.find(x=>x.id===e.ventureId);
    return v && v.status==="open" && !v.archived;
  });

  for(const e of expenses){
    const participants = expenseParticipants(e);
    if(!participants.length) continue;

    const amountCents = toCents(e.amount);
    balances[e.paidBy] += amountCents;

    for(const share of expenseSplitCents(e)){
      balances[share.personId] -= share.cents;
    }
  }

  const payments = ventureId ? state.payments.filter(p=>!p.ventureId || p.ventureId===ventureId) : state.payments;
  for(const p of payments){
    const amountCents = toCents(p.amount);
    balances[p.from] += amountCents;
    balances[p.to] -= amountCents;
  }

  return balances;
}
function settlements(balances){
  // balances enthält Centwerte.
  const debtors = Object.entries(balances).filter(([_,v])=>v < 0).map(([id,v])=>({id, amount:-v}));
  const creditors = Object.entries(balances).filter(([_,v])=>v > 0).map(([id,v])=>({id, amount:v}));
  debtors.sort((a,b)=>b.amount-a.amount);
  creditors.sort((a,b)=>b.amount-a.amount);

  const result=[];
  let i=0,j=0;
  while(i<debtors.length && j<creditors.length){
    const amt = Math.min(debtors[i].amount, creditors[j].amount);
    if(amt > 0) result.push({from:debtors[i].id, to:creditors[j].id, amount:amt});
    debtors[i].amount -= amt;
    creditors[j].amount -= amt;
    if(debtors[i].amount === 0) i++;
    if(creditors[j].amount === 0) j++;
  }
  return result;
}
function totalOpen(){ return settlements(computeBalances()).reduce((s,x)=>s+x.amount,0); }
function ventureTotal(id){ return ventureExpenses(id).reduce((s,e)=>s+toCents(e.amount),0); }

function htmlHeader(){
  return `<section class="hero">
    <small>Stand: ${fmtDate(today())}</small>
    <h1>Ritter-Kasse</h1>
    <div class="open"><div><div class="label">Offene Gesamtsumme</div><div style="color:rgba(255,255,255,.78);font-size:13px;margin-top:3px;">über alle offenen Unternehmungen</div></div><div class="value">${fmtEURFromCents(totalOpen())}</div></div>
  </section>`;
}
function nav(){
  return `<div class="topnav">
    <div class="topnav-tabs">
      ${tab("start","Start")}${tab("ventures","Unternehm.")}${tab("balances","Salden")}${tab("settings","Einstell.")}
    </div>
  </div>`;
}
function tab(id,label){
  const active =
    view===id ||
    (id==="ventures" && ["ventureDetail","newVenture","expenseForm"].includes(view)) ||
    (id==="balances" && view==="paymentForm");
  return `<div class="tab ${active?"active":""}" onclick="mainNavigate('${id}')">${label}</div>`;
}

function doNavigate(v, opts={}){
  if(!opts.replace && view !== v){
    historyStack.push({
      view,
      selectedVentureId,
      ventureTab,
      editingExpenseId
    });
  }
  previousView = view;
  view = v;
  if(opts.ventureTab) ventureTab = opts.ventureTab;
  if(opts.clearEdit) editingExpenseId = null;
  if(["newVenture","expenseForm","paymentForm"].includes(v)) clearDirty();
  render();
  window.scrollTo(0,0);
}

function navigate(v, opts={}){
  attemptLeave(()=>doNavigate(v, opts));
}

function doMainNavigate(v){
  historyStack = [];
  editingExpenseId = null;
  view = v;
  clearDirty();
  render();
  window.scrollTo(0,0);
}

function mainNavigate(v){
  attemptLeave(()=>doMainNavigate(v));
}

function doBack(){
  const last = historyStack.pop();
  if(last){
    view = last.view;
    selectedVentureId = last.selectedVentureId;
    ventureTab = last.ventureTab;
    editingExpenseId = last.editingExpenseId;
  }else if(view==="newVenture"){
    view = "ventures";
  }else if(view==="expenseForm"){
    view = "ventureDetail";
    ventureTab = "expenses";
    editingExpenseId = null;
  }else if(view==="paymentForm"){
    view = "balances";
  }else if(view==="ventureDetail"){
    view = "ventures";
  }else if(["people","about","changelog"].includes(view)){
    view = "settings";
  }else{
    view = "start";
  }
  render();
  window.scrollTo(0,0);
}

function back(){
  attemptLeave(()=>doBack());
}

function pageTitle(){
  if(view==="newVenture") return "Neue Unternehmung";
  if(view==="ventureDetail") return state.ventures.find(v=>v.id===selectedVentureId)?.name || "Unternehmung";
  if(view==="expenseForm") return editingExpenseId ? "Ausgabe bearbeiten" : "Ausgabe hinzufügen";
  if(view==="paymentForm") return "Ausgleichszahlung";
  if(view==="ventures") return "Unternehmungen";
  if(view==="balances") return "Salden";
  if(view==="settings") return "Einstellungen";
  if(view==="people") return "Personen";
  if(view==="about") return "Über Ritter-Kasse";
  if(view==="changelog") return "Changelog";
  return "";
}

function backLabel(){
  const last = historyStack[historyStack.length-1];
  if(last){
    if(last.view==="ventureDetail") return state.ventures.find(v=>v.id===last.selectedVentureId)?.name || "Unternehmung";
    if(last.view==="ventures") return "Unternehmungen";
    if(last.view==="balances") return "Salden";
    if(last.view==="settings") return "Einstellungen";
    if(last.view==="people") return "Personen";
    if(last.view==="about") return "Über Ritter-Kasse";
    if(last.view==="changelog") return "Changelog";
    if(last.view==="start") return "Start";
  }
  if(view==="people" || view==="about" || view==="changelog") return "Einstellungen";
  if(view==="newVenture") return "Unternehmungen";
  if(view==="expenseForm") return state.ventures.find(v=>v.id===selectedVentureId)?.name || "Unternehmung";
  if(view==="paymentForm") return "Salden";
  if(view==="ventureDetail") return "Unternehmungen";
  return "Start";
}

function isDialogView(){
  return ["newVenture","expenseForm","paymentForm","ventureDetail","people","about","changelog"].includes(view);
}

function topbar(){
  const icon = sectionIcon(view);
  if(!isDialogView()) return `<div class="section-icon-only" aria-hidden="true">${icon}</div>`;
  return `<div class="topbar"><button class="back" onclick="back()">← ${escapeHtml(backLabel())}</button><div class="topbar-icon" aria-hidden="true">${icon}</div></div>`;
}

function sectionIcon(viewName=view){
  if(["ventures","ventureDetail","newVenture","expenseForm"].includes(viewName)) return "⚔️";
  if(["balances","paymentForm"].includes(viewName)) return "💰→💰";
  if(["settings","people","about","changelog"].includes(viewName)) return "⚙️";
  return "🏰";
}

function pageHeading(title, subtitle=""){
  return `<div class="section-title" style="margin-top:6px">${escapeHtml(title)}</div>${subtitle?`<p class="hint">${escapeHtml(subtitle)}</p>`:""}`;
}

function footer(){
  return `<div class="footer">Ritter-Kasse – Version 3.10<br>Build 20260701-006<br>© 2026 Jürgen Lindner</div>`;
}

function render(){
  const app=document.getElementById("app");
  if(view==="start") app.innerHTML = nav()+topbar()+htmlHeader()+renderStart();
  if(view==="ventures") app.innerHTML = nav()+topbar()+pageHeading("Unternehmungen","Offene und abgeschlossene Unternehmungen verwalten.")+renderVentures();
  if(view==="newVenture") app.innerHTML = nav()+topbar()+renderNewVenture();
  if(view==="ventureDetail") app.innerHTML = nav()+topbar()+renderVentureDetail();
  if(view==="expenseForm") app.innerHTML = nav()+topbar()+renderExpenseForm();
  if(view==="paymentForm") app.innerHTML = nav()+topbar()+renderPaymentForm();
  if(view==="balances") app.innerHTML = nav()+topbar()+pageHeading("Salden","Gesamtabrechnung über alle offenen Unternehmungen.")+renderBalances(null);
  if(view==="settings") app.innerHTML = nav()+topbar()+pageHeading("Einstellungen","Lokale Daten verwalten.")+renderSettings();
  if(view==="people") app.innerHTML = nav()+topbar()+renderPeopleSettings();
  if(view==="about") app.innerHTML = nav()+topbar()+renderAbout();
  if(view==="changelog") app.innerHTML = nav()+topbar()+renderChangelog();
  app.innerHTML += footer();
  attachDirtyListeners();
}

function attachDirtyListeners(){
  if(!isEditableView()) return;
  document.querySelectorAll("input, select, textarea").forEach(el=>{
    el.addEventListener("input", markDirty);
    el.addEventListener("change", markDirty);
  });
  if(view==="expenseForm"){
    const amountInput = document.getElementById("eAmount");
    if(amountInput){
      amountInput.addEventListener("input", updateExpenseSplitHint);
      amountInput.addEventListener("change", updateExpenseSplitHint);
    }
    setTimeout(updateExpenseSplitHint, 0);
  }
}
function renderStart(){
  return `<section class="actions">
    <button class="primary" onclick="navigate('newVenture')">+ Neue Unternehmung</button>
    <button class="secondary" onclick="navigate('paymentForm')">Ausgleichszahlung eintragen</button>
  </section>
  ${renderOpenVentures()}
  ${renderBalances(null, true)}`;
}
function renderOpenVentures(){
  const open = state.ventures.filter(v=>v.status==="open" && !v.archived);
  return `<section class="card"><h2>Offene Unternehmungen</h2>
    ${open.length?open.map(ventureCard).join(""):`<div class="muted">Keine offenen Unternehmungen.</div>`}
  </section>`;
}
function ventureCard(v){
  return `<div class="venture" onclick="selectedVentureId='${v.id}'; navigate('ventureDetail')">
    <div><div class="venture-title">${escapeHtml(v.name)}</div>
    <div class="venture-meta"><span class="status ${v.status==="open"?"open":"closed"}">${v.status==="open"?"offen":"abgeschlossen"}</span>${fmtDateRange(v)} · erstellt von ${personName(v.createdBy)}<br>${v.participants.length} Teilnehmer · ${ventureExpenses(v.id).length} Ausgaben</div></div>
    <span class="badge">${fmtEURFromCents(ventureTotal(v.id))}</span>
  </div>`;
}
function renderVentures(){
  const open=state.ventures.filter(v=>v.status==="open" && !v.archived);
  const archived=state.ventures.filter(v=>v.status!=="open" || v.archived);
  return `<section class="actions"><button class="primary" onclick="navigate('newVenture')">+ Neue Unternehmung</button></section>
    <section class="card"><h2>Offene Unternehmungen</h2>${open.map(ventureCard).join("") || "<div class='muted'>Keine offenen Unternehmungen.</div>"}</section>
    <section class="card"><h2>Archiv / abgeschlossen</h2>${archived.map(ventureCard).join("") || "<div class='muted'>Noch nichts abgeschlossen.</div>"}</section>`;
}
function renderBalances(ventureId=null, compact=false){
  const b=computeBalances(ventureId);
  const set=settlements(b);
  return `<section class="card"><h2>${ventureId ? "Salden dieser Unternehmung" : "Aktuelle Salden insgesamt"}</h2>
    ${PEOPLE.map(p=>`<div class="row"><span class="name">${p.name}</span><span class="${b[p.id]>0?"pos":b[p.id]<0?"neg":"muted"}">${fmtEURFromCents(b[p.id])}</span></div>`).join("")}
  </section>
  ${compact ? "" : `<section class="card"><h2>Wer zahlt wem?</h2>
    ${set.length?set.map(s=>`<div class="payline"><span>${personName(s.from)} <span class="arrow">→</span> ${personName(s.to)}</span><span class="amount">${fmtEURFromCents(s.amount)}</span></div>`).join(""):`<div class="muted">Alles ausgeglichen.</div>`}
  </section>`}`;
}
function renderNewVenture(){
  return `<div class="section-title">Neue Unternehmung</div><p class="hint">Name darf kreativ sein. Das Enddatum ist optional.</p>
  <section class="card">
    <label>Name der Unternehmung</label><input id="vName" value="">
    <div class="two"><div><label>Startdatum</label><input id="vStart" type="date" value="${today()}"></div><div><label>Enddatum optional</label><input id="vEnd" type="date"></div></div>
    <label>Erstellt von</label><select id="vCreator">${PEOPLE.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}</select>
    <label>Wer ist dabei?</label><div class="toggle-list">${PEOPLE.map(p=>toggleHtml("vp_"+p.id,p.name,true)).join("")}</div>
    <div id="dupWarning"></div>
    <div style="height:14px"></div><button class="primary" onclick="createVenture()">Unternehmung speichern</button>
  </section>`;
}
function toggleHtml(id, name, on){
  return `<div class="toggle" data-on="${on?1:0}" id="${id}" onclick="toggle('${id}')"><span>${name}</span><span class="pill ${on?"":"off"}">${on?"war dabei":"war nicht dabei"}</span></div>`;
}
function toggle(id){
  const el=document.getElementById(id);
  const on=el.dataset.on==="1";
  el.dataset.on=on?"0":"1";
  el.querySelector(".pill").className="pill "+(on?"off":"");
  el.querySelector(".pill").textContent=on?"war nicht dabei":"war dabei";
  markDirty();
  if(id.startsWith("ep_")) updateExpenseSplitHint();
}
function getTogglePeople(prefix){
  return PEOPLE.filter(p=>document.getElementById(prefix+p.id)?.dataset.on==="1").map(p=>p.id);
}
function createVenture(silent=false){
  const name=document.getElementById("vName").value.trim();
  if(!name){ toast("Bitte Namen eingeben."); return false; }
  const start=document.getElementById("vStart").value;
  const end=document.getElementById("vEnd").value;
  const participants=getTogglePeople("vp_");
  if(!participants.length){ toast("Speichern nicht möglich: Bitte mindestens eine beteiligte Person auswählen."); return false; }
  const similar = state.ventures.find(v => !v.archived && v.startDate===start && similarity(v.name, name) > 0.45);
  if(similar && !confirm(`Es gibt bereits eine ähnliche Unternehmung am gleichen Datum:\n\n${similar.name}\n\nTrotzdem neu anlegen?`)){
    selectedVentureId=similar.id; navigate("ventureDetail", {replace:true}); return;
  }
  const v={id:uid("u"), name, startDate:start, endDate:end, status:"open", createdBy:document.getElementById("vCreator").value, archived:false, participants, createdAt:new Date().toISOString()};
  state.ventures.unshift(v); save(); selectedVentureId=v.id; clearDirty();
  if(!silent){ navigate("ventureDetail", {replace:true}); toast("Unternehmung gespeichert."); }
  return true;
}
function renderVentureDetail(){
  const v=state.ventures.find(x=>x.id===selectedVentureId) || state.ventures[0];
  if(!v) return "<section class='card'>Keine Unternehmung vorhanden.</section>";
  selectedVentureId=v.id;
  const inner = ventureTab==="expenses" ? renderVentureExpenses(v) : ventureTab==="settlement" ? renderBalances(v.id) : renderVentureManage(v);
  return `<section class="card"><h2>${escapeHtml(v.name)}</h2>
    <div class="muted">${fmtDateRange(v)} · erstellt von ${personName(v.createdBy)} · <span class="status ${v.status==="open"?"open":"closed"}">${v.status==="open"?"offen":"abgeschlossen"}</span></div>
    <div class="participants">${v.participants.map(pid=>`<span class="chip">${personName(pid)}</span>`).join("")}</div>
    <div class="tabs-inner">
      <div class="inner-tab ${ventureTab==="expenses"?"active":""}" onclick="ventureTab='expenses'; render()">Ausgaben</div>
      <div class="inner-tab ${ventureTab==="settlement"?"active":""}" onclick="ventureTab='settlement'; render()">Abrechnung</div>
      <div class="inner-tab ${ventureTab==="manage"?"active":""}" onclick="ventureTab='manage'; render()">Details</div>
    </div>
  </section>${inner}`;
}
function renderVentureExpenses(v){
  const expenses=ventureExpenses(v.id);
  return `<section class="actions"><button class="primary" onclick="editingExpenseId=null; navigate('expenseForm')">+ Ausgabe hinzufügen</button></section>
  <section class="card"><h2>Ausgaben</h2>
    ${expenses.length?expenses.map(e=>{
      const parts=expenseParticipants(e);
      const custom=e.participantIds && e.participantIds.length;
      return `<div class="expense"><div><div class="desc">${escapeHtml(e.desc)}</div><div class="sub">${fmtDate(e.date)} · bezahlt von ${personName(e.paidBy)} · geteilt durch ${parts.length}${custom?" · abweichend":""}</div></div><div class="amount">${fmtEUR(e.amount)}</div>
      ${splitExplanationHtml(e)}
      <div class="right-buttons" style="grid-column:1 / -1"><button class="ghost mini" onclick="editExpense('${e.id}')">Bearbeiten</button><button class="danger mini" onclick="deleteExpense('${e.id}')">Löschen</button></div></div>`
    }).join(""):"<div class='muted'>Noch keine Ausgaben.</div>"}
  </section>`;
}
function renderVentureManage(v){
  return `<section class="card"><h2>Unternehmung verwalten</h2>
    <label>Name</label><input id="editVName" value="${escapeAttr(v.name)}">
    <div class="two"><div><label>Startdatum</label><input id="editVStart" type="date" value="${v.startDate}"></div><div><label>Enddatum</label><input id="editVEnd" type="date" value="${v.endDate||""}"></div></div>
    <label>Teilnehmer</label><div class="toggle-list">${PEOPLE.map(p=>toggleHtml("editvp_"+p.id,p.name,v.participants.includes(p.id))).join("")}</div>
    <div style="height:12px"></div><button class="primary" onclick="saveVentureDetails('${v.id}')">Änderungen speichern</button>
    <div style="height:8px"></div><button class="secondary" onclick="toggleVentureStatus('${v.id}')">${v.status==="open"?"Unternehmung abschließen":"Unternehmung wieder öffnen"}</button>
    <div class="delete-box"><strong>Gefährlicher Bereich</strong><br>Beim Löschen werden die Unternehmung und alle zugehörigen Ausgaben entfernt.</div>
    <div style="height:8px"></div><button class="danger" onclick="deleteVenture('${v.id}')">Unternehmung löschen</button>
  </section>`;
}
function saveVentureDetails(id){
  const v=state.ventures.find(x=>x.id===id);
  v.name=document.getElementById("editVName").value.trim() || v.name;
  v.startDate=document.getElementById("editVStart").value || v.startDate;
  v.endDate=document.getElementById("editVEnd").value;
  const parts=getTogglePeople("editvp_");
  if(parts.length) v.participants=parts;
  save(); render(); toast("Gespeichert.");
}
function toggleVentureStatus(id){
  const v=state.ventures.find(x=>x.id===id);
  v.status = v.status==="open" ? "closed" : "open";
  v.archived = v.status==="closed";
  save(); render(); toast(v.status==="open"?"Wieder geöffnet.":"Abgeschlossen.");
}
function deleteVenture(id){
  const v=state.ventures.find(x=>x.id===id);
  if(!confirm(`Diese Unternehmung wirklich löschen?\n\n${v.name}\n\nAlle zugehörigen Ausgaben werden gelöscht.`)) return;
  state.ventures=state.ventures.filter(x=>x.id!==id);
  state.expenses=state.expenses.filter(e=>e.ventureId!==id);
  state.payments=state.payments.filter(p=>p.ventureId!==id);
  selectedVentureId=state.ventures[0]?.id||null; save(); mainNavigate("ventures"); toast("Gelöscht.");
}
function editExpense(id){ editingExpenseId=id; navigate("expenseForm"); }
function deleteExpense(id){ if(confirm("Ausgabe löschen?")){ state.expenses=state.expenses.filter(e=>e.id!==id); save(); render(); } }

function renderExpenseForm(){
  const ventures=state.ventures.filter(v=>v.status==="open" && !v.archived);
  const e=editingExpenseId ? state.expenses.find(x=>x.id===editingExpenseId) : null;
  const currentV = state.ventures.find(v=>v.id===(e?.ventureId||selectedVentureId)) || ventures[0] || state.ventures[0];
  const custom = e?.participantIds && e.participantIds.length;
  const selectedParts = custom ? e.participantIds : currentV?.participants || PEOPLE.map(p=>p.id);
  return `<section class="card" style="margin-bottom:10px"><h2>${escapeHtml(currentV?.name || "Unternehmung")}</h2><div class="muted">${currentV ? fmtDateRange(currentV) + " · " + currentV.participants.length + " Teilnehmer · " + (currentV.status==="open"?"offen":"abgeschlossen") : ""}</div></section>
  <div class="section-title">${e?"Ausgabe bearbeiten":"Ausgabe hinzufügen"}</div>
  <section class="card">
    <label>Unternehmung</label><select id="eVenture" onchange="selectedVentureId=this.value; render()">${state.ventures.filter(v=>v.status==="open").map(v=>`<option value="${v.id}" ${v.id===currentV?.id?"selected":""}>${escapeHtml(v.name)}</option>`).join("")}</select>
    <label>Beschreibung</label><input id="eDesc" value="${escapeAttr(e?.desc||"")}">
    <label>Betrag</label><input id="eAmount" value="${e?fmtEUR(e.amount):""}" inputmode="decimal" placeholder="z. B. 32,00 oder 32.00"><div class="sub" style="margin-top:6px">Komma oder Punkt sind erlaubt.</div><div id="liveSplitHint" class="info-note hidden"></div>
    <label>Datum</label><input id="eDate" type="date" value="${e?.date||today()}">
    <label>Bezahlt von</label><select id="ePaidBy">${PEOPLE.map(p=>`<option value="${p.id}" ${p.id===(e?.paidBy||"juergen")?"selected":""}>${p.name}</option>`).join("")}</select><div class="sub" style="margin-top:6px">Die zahlende Person muss an diesem Posten bzw. dieser Aktivität nicht beteiligt sein.</div>
    <div class="inline-option" onclick="setCustomSplit(false)"><div class="checkbox-row"><div id="splitAllBox" class="fakebox ${!custom?"checked":""}"></div><div><strong>Auf alle Teilnehmer der Unternehmung verteilen</strong><br><span class="muted">${(currentV?.participants||[]).map(personName).join(", ")}</span></div></div></div>
    <div class="inline-option" onclick="setCustomSplit(true)"><div class="checkbox-row"><div id="splitCustomBox" class="fakebox ${custom?"checked":""}"></div><div><strong>Abweichende Beteiligte für diesen Posten</strong><br><span class="muted">Für Taxi, getrennte Getränke, einzelne Aktivitäten usw.</span></div></div></div>
    <div id="customParticipants" class="${custom?"":"hidden"}">
      <label>Beteiligte dieses Postens</label><div class="toggle-list">${PEOPLE.map(p=>toggleHtml("ep_"+p.id,p.name,selectedParts.includes(p.id))).join("")}</div>
    </div>
    <div style="height:14px"></div><button class="primary" onclick="saveExpense()">${e?"Änderungen speichern":"Ausgabe speichern"}</button>
  </section>`;
}
function setCustomSplit(on){
  document.getElementById("splitAllBox").className="fakebox "+(!on?"checked":"");
  document.getElementById("splitCustomBox").className="fakebox "+(on?"checked":"");
  document.getElementById("customParticipants").className=on?"":"hidden";
  markDirty();
  updateExpenseSplitHint();
}
function saveExpense(silent=false){
  const ventureId=document.getElementById("eVenture").value;
  const desc=document.getElementById("eDesc").value.trim();
  const amount=parseAmount(document.getElementById("eAmount").value);
  if(!desc){ toast("Bitte Beschreibung eingeben."); return false; }
  if(Number.isNaN(amount)){ toast("Bitte gültigen Betrag eingeben, z. B. 12,80 oder 12.80."); return false; }
  if(amount<=0){ toast("Speichern nicht möglich: Der Betrag muss größer als 0 sein."); return false; }
  const custom = document.getElementById("splitCustomBox").classList.contains("checked");
  let participantIds = custom ? getTogglePeople("ep_") : null;
  if(custom && !participantIds.length){ toast("Mindestens eine beteiligte Person für diesen Posten wählen."); return false; }
  if(editingExpenseId){
    const e=state.expenses.find(x=>x.id===editingExpenseId);
    Object.assign(e,{ventureId,desc,amount,paidBy:document.getElementById("ePaidBy").value,date:document.getElementById("eDate").value,participantIds});
  }else{
    state.expenses.unshift({id:uid("a"),ventureId,desc,amount,paidBy:document.getElementById("ePaidBy").value,date:document.getElementById("eDate").value,participantIds});
  }
  selectedVentureId=ventureId; editingExpenseId=null; save(); clearDirty();
  if(!silent){ view="ventureDetail"; ventureTab="expenses"; historyStack=[]; render(); toast("Ausgabe gespeichert."); }
  return true;
}
function renderPaymentForm(){
  const openVentures=state.ventures.filter(v=>v.status==="open" && !v.archived);
  return `<div class="section-title">Ausgleichszahlung</div><p class="hint">Eine Zahlung reduziert offene Salden. Optional kann sie einer Unternehmung zugeordnet werden.</p>
  <section class="card">
    <label>Von</label><select id="pFrom">${PEOPLE.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}</select>
    <label>An</label><select id="pTo">${PEOPLE.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}</select>
    <label>Betrag</label><input id="pAmount" inputmode="decimal" placeholder="z. B. 12,80 oder 12.80"><div class="sub" style="margin-top:6px">Komma oder Punkt sind erlaubt.</div>
    <label>Datum</label><input id="pDate" type="date" value="${today()}">
    <label>Zuordnung optional</label><select id="pVenture"><option value="">allgemein / nicht zugeordnet</option>${openVentures.map(v=>`<option value="${v.id}">${escapeHtml(v.name)}</option>`).join("")}</select>
    <div style="height:14px"></div><button class="primary" onclick="savePayment()">Zahlung speichern</button>
  </section>`;
}
function savePayment(silent=false){
  const from=document.getElementById("pFrom").value, to=document.getElementById("pTo").value;
  const amount=parseAmount(document.getElementById("pAmount").value);
  if(from===to){ toast("Von und An dürfen nicht gleich sein."); return false; }
  if(Number.isNaN(amount)){ toast("Bitte gültigen Betrag eingeben, z. B. 12,80 oder 12.80."); return false; }
  if(amount<=0){ toast("Speichern nicht möglich: Der Betrag muss größer als 0 sein."); return false; }
  state.payments.unshift({id:uid("z"),from,to,amount,date:document.getElementById("pDate").value,ventureId:document.getElementById("pVenture").value||null});
  save(); clearDirty();
  if(!silent){ mainNavigate("balances"); toast("Zahlung gespeichert."); }
  return true;
}

function settingsButton(icon, title, subtitle, action, kind="ghost"){
  return `<button class="${kind} settings-action" onclick="${action}">
    <span class="settings-action-icon">${icon}</span>
    <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></span>
  </button>`;
}

function renderSettings(){
  return `<section class="card"><h2>Einstellungen</h2>
    <div class="warning">
      Version ${APP_VERSION} speichert alle Daten weiterhin lokal in diesem Browser auf diesem Gerät.
      Backup und Import sind jetzt aktiv. Die gemeinsame Cloud-Synchronisation folgt später mit Version 4.0.
    </div>
  </section>

  <section class="card settings-group"><h2>Daten</h2>
    ${settingsButton("⬇️","Backup erstellen","Lokale Daten als JSON-Datei sichern.","exportData()","secondary")}
    ${settingsButton("⬆️","Backup importieren","Eine zuvor exportierte Sicherung wiederherstellen.","triggerImport()")}
  </section>

  <section class="card settings-group"><h2>Verwaltung</h2>
    ${settingsButton("👥","Personen","Aktuelle Personen anzeigen. Bearbeiten folgt mit Cloud/Admin.","navigate('people')")}
  </section>

  <section class="card settings-group"><h2>Information</h2>
    ${settingsButton("ℹ️","Über Ritter-Kasse","Version, Build und Speicherhinweise anzeigen.","navigate('about')")}
    ${settingsButton("📄","Changelog","Versionshistorie anzeigen.","navigate('changelog')")}
  </section>

  <section class="card settings-group"><h2>Entwicklung</h2>
    ${settingsButton("🧪","Backup testen","Aktuellen Datenbestand intern als Backup prüfen.","testBackup()")}
    ${settingsButton("🗑","Lokale Daten löschen","Alle lokalen Unternehmungen, Ausgaben und Zahlungen entfernen.","deleteLocalData()","danger")}
  </section>`;
}

function backupObject(){
  return {
    app: "Ritter-Kasse",
    schema: 1,
    version: APP_VERSION,
    build: APP_BUILD,
    created: new Date().toISOString(),
    people: PEOPLE,
    data: {
      ventures: state.ventures || [],
      expenses: state.expenses || [],
      payments: state.payments || []
    }
  };
}

function backupFileName(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  return `Ritter-Kasse_Backup_${stamp}.json`;
}

function normalizeBackup(obj){
  if(obj && obj.app === "Ritter-Kasse" && obj.data) return obj;
  if(obj && Array.isArray(obj.ventures) && Array.isArray(obj.expenses) && Array.isArray(obj.payments)){
    return {
      app: "Ritter-Kasse",
      schema: 0,
      version: "legacy",
      build: "unknown",
      created: "",
      people: PEOPLE,
      data: {
        ventures: obj.ventures,
        expenses: obj.expenses,
        payments: obj.payments
      }
    };
  }
  return null;
}

function validateBackup(obj){
  const backup = normalizeBackup(obj);
  const errors = [];
  if(!backup){ return {ok:false, errors:["Keine gültige Ritter-Kasse-Backup-Datei."], backup:null}; }

  const data = backup.data || {};
  if(!Array.isArray(data.ventures)) errors.push("ventures fehlt oder ist keine Liste.");
  if(!Array.isArray(data.expenses)) errors.push("expenses fehlt oder ist keine Liste.");
  if(!Array.isArray(data.payments)) errors.push("payments fehlt oder ist keine Liste.");

  const peopleIds = new Set(PEOPLE.map(p=>p.id));
  const ventureIds = new Set((data.ventures || []).map(v=>v.id).filter(Boolean));

  for(const v of data.ventures || []){
    if(!v.id) errors.push("Eine Unternehmung hat keine ID.");
    if(!v.name) errors.push(`Unternehmung ${v.id || "ohne ID"} hat keinen Namen.`);
    for(const pid of (v.participants || [])){
      if(!peopleIds.has(pid)) errors.push(`Unbekannte Person in Unternehmung "${v.name || v.id}": ${pid}`);
    }
    if(v.createdBy && !peopleIds.has(v.createdBy)) errors.push(`Unbekannter Ersteller in Unternehmung "${v.name || v.id}": ${v.createdBy}`);
  }

  for(const e of data.expenses || []){
    if(!e.id) errors.push("Eine Ausgabe hat keine ID.");
    if(!ventureIds.has(e.ventureId)) errors.push(`Ausgabe "${e.desc || e.id}" verweist auf unbekannte Unternehmung.`);
    if(!peopleIds.has(e.paidBy)) errors.push(`Ausgabe "${e.desc || e.id}" hat unbekannten Zahler: ${e.paidBy}`);
    if(!Number.isFinite(Number(e.amount)) || Number(e.amount) < 0) errors.push(`Ausgabe "${e.desc || e.id}" hat keinen gültigen Betrag.`);
    for(const pid of (e.participantIds || [])){
      if(!peopleIds.has(pid)) errors.push(`Ausgabe "${e.desc || e.id}" enthält unbekannte beteiligte Person: ${pid}`);
    }
  }

  for(const p of data.payments || []){
    if(!peopleIds.has(p.from)) errors.push(`Ausgleichszahlung mit unbekanntem Zahler: ${p.from}`);
    if(!peopleIds.has(p.to)) errors.push(`Ausgleichszahlung mit unbekanntem Empfänger: ${p.to}`);
    if(!Number.isFinite(Number(p.amount)) || Number(p.amount) < 0) errors.push("Ausgleichszahlung mit ungültigem Betrag.");
    if(p.ventureId && !ventureIds.has(p.ventureId)) errors.push("Ausgleichszahlung verweist auf unbekannte Unternehmung.");
  }

  return {ok: errors.length===0, errors, backup};
}

function backupSummary(backup){
  const data = backup.data || {};
  return `${backup.app || "Ritter-Kasse"}\\nVersion: ${backup.version || "unbekannt"}\\nBuild: ${backup.build || "unbekannt"}\\nErstellt: ${backup.created ? new Date(backup.created).toLocaleString("de-DE") : "unbekannt"}\\n\\n${(backup.people || PEOPLE).length} Personen\\n${(data.ventures || []).length} Unternehmungen\\n${(data.expenses || []).length} Ausgaben\\n${(data.payments || []).length} Ausgleichszahlungen`;
}

function exportData(){
  const backup = backupObject();
  const blob = new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup erstellt.");
}

function triggerImport(){
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = () => {
    const file = input.files && input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => importBackupText(String(reader.result || ""));
    reader.onerror = () => toast("Datei konnte nicht gelesen werden.");
    reader.readAsText(file);
  };
  input.click();
}

function importBackupText(text){
  let obj;
  try{
    obj = JSON.parse(text);
  }catch(e){
    alert("Import fehlgeschlagen:\\n\\nDie Datei enthält kein gültiges JSON.");
    return;
  }

  const result = validateBackup(obj);
  if(!result.ok){
    alert("Import nicht möglich:\\n\\n" + result.errors.slice(0,12).join("\\n") + (result.errors.length>12 ? "\\n..." : ""));
    return;
  }

  const backup = result.backup;
  const ok = confirm("Backup importieren?\\n\\n" + backupSummary(backup) + "\\n\\nDie aktuellen lokalen Daten werden ersetzt.");
  if(!ok) return;

  state = {
    ventures: backup.data.ventures || [],
    expenses: backup.data.expenses || [],
    payments: backup.data.payments || []
  };
  save();
  selectedVentureId = state.ventures[0]?.id || null;
  historyStack = [];
  editingExpenseId = null;
  view = "start";
  clearDirty();
  render();
  window.scrollTo(0,0);
  toast("Import erfolgreich.");
}

function testBackup(){
  const result = validateBackup(backupObject());
  if(result.ok){
    alert("Backup-Test erfolgreich\\n\\n" + backupSummary(result.backup) + "\\n\\nDas Backup kann später wieder importiert werden.");
  }else{
    alert("Backup-Test fehlgeschlagen:\\n\\n" + result.errors.join("\\n"));
  }
}

function deleteLocalData(){
  const first = confirm("Alle lokalen Daten löschen?\\n\\nAlle Unternehmungen, Ausgaben und Zahlungen werden von diesem Gerät entfernt.\\n\\nEs wird empfohlen, vorher ein Backup zu erstellen.");
  if(!first) return;
  const second = confirm("Wirklich löschen?\\n\\nDieser Schritt kann nur durch Import eines Backups rückgängig gemacht werden.");
  if(!second) return;

  state = {ventures:[], expenses:[], payments:[]};
  save();
  selectedVentureId = null;
  historyStack = [];
  editingExpenseId = null;
  view = "start";
  clearDirty();
  render();
  window.scrollTo(0,0);
  toast("Lokale Daten gelöscht.");
}

function renderPeopleSettings(){
  return `${pageHeading("Personen","Die Personenverwaltung wird mit der Cloud-Version über Admin-Rechte freigeschaltet.")}
    <section class="card">
      <h2>Aktuelle Personen</h2>
      ${PEOPLE.map(p=>`<div class="row"><span class="name">${escapeHtml(p.name)}</span><span class="muted">${escapeHtml(p.id)}</span></div>`).join("")}
      <div class="warning">In der lokalen Version können Personen noch nicht geändert werden. So bleiben ältere Unternehmungen, Ausgaben und Backups konsistent.</div>
    </section>`;
}

function renderAbout(){
  return `${pageHeading("Über Ritter-Kasse","Lokale Web-App für gemeinsame Unternehmungen.")}
    <section class="card">
      <h2>Version</h2>
      <div class="row"><span>Version</span><strong>${APP_VERSION}</strong></div>
      <div class="row"><span>Build</span><strong>${APP_BUILD}</strong></div>
      <div class="row"><span>Speicherung</span><span class="muted">lokal im Browser</span></div>
    </section>
    <section class="card">
      <h2>Hinweis</h2>
      <p class="hint" style="margin:0">Die lokale Version synchronisiert noch nicht zwischen mehreren Geräten. Für den Wechsel auf ein anderes Gerät bitte ein Backup exportieren und dort importieren.</p>
    </section>`;
}

function renderChangelog(){
  return `${pageHeading("Changelog","Versionshistorie der lokalen Ritter-Kasse.")}
    <section class="card"><pre class="changelog-box"># Changelog

## 3.9 – Build 20260701-005

- Bereichs-Piktogramme in die obere Seitenleiste verschoben.
- Piktogramme erscheinen jetzt auch auf Unterseiten:
  - Start: Burg
  - Unternehmungen und Unterseiten: gekreuzte Schwerter
  - Salden und Ausgleichszahlung: Geldfluss-Symbol
  - Einstellungen: Zahnrad
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.8 – Build 20260701-004

- Dezente Seiten-Piktogramme für die Hauptbereiche ergänzt:
  - Start: Burg im Titelbereich
  - Unternehmungen: gekreuzte Schwerter
  - Salden: Geldfluss-Symbol
  - Einstellungen: Zahnrad
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.7 – Build 20260701-003

- Startseite vereinfacht: Dort werden nur noch die aktuellen Salden insgesamt angezeigt.
- Die Detailanzeige „Wer zahlt wem?“ bleibt dem Menüpunkt „Salden“ vorbehalten.
- Rück-Button in der Detailansicht einzelner Unternehmungen ergänzt.
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.6 – Build 20260701-002

- Ausgabeformular fachlich klarer formuliert:
  - „Abweichende Beteiligte für diesen Posten“
  - „Beteiligte dieses Postens“
- Hinweis ergänzt: Die zahlende Person muss an diesem Posten bzw. dieser Aktivität nicht beteiligt sein.
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.5 – Build 20260701-001

- Helleres Ritterhelm-/Schatztruhen-Icon als offizielles App-Icon übernommen.
- Burg-Emoji im Kopfbereich vergrößert und rechts neben den Titel gesetzt.
- Restcent-Hinweis im Ausgabeformular wird jetzt live aktualisiert, wenn Betrag oder Teilnehmer geändert werden.
- Datumsfelder aus Version 3.2.1 beibehalten.
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.2 – Build 20260630-003

- Angefügtes Ritterhelm-/Schatztruhen-Icon als offizielles App-Icon übernommen.
- \`apple-touch-icon.png\` für iPhone-Homescreen ergänzt.
- \`icon-192.png\` und \`icon-512.png\` aus demselben Icon erzeugt.
- \`index.html\` um Apple-Homescreen-Metatags ergänzt bzw. aktualisiert.
- Datumsfelder auf kleinen Displays schmaler und robuster gemacht.
- Versionsnummer und Build aktualisiert.

## 3.0.1 Beta – Build 20260629-004

- Lokalen Test robuster gemacht.
- \`dirtyModal\` ist jetzt inline versteckt, falls \`style.css\` nicht geladen wird.
- Hinweis ergänzt, wenn \`app.js\`/\`style.css\` fehlen.
- Service Worker wird lokal über \`file://\` nicht registriert.

## 3.0 Beta

- Projektstruktur modernisiert.
- App in mehrere Dateien aufgeteilt.
- PWA-Grundstruktur vorbereitet.
</pre></section>`;
}

function similarity(a,b){
  a=a.toLowerCase(); b=b.toLowerCase();
  const aw=new Set(a.split(/\W+/).filter(Boolean)), bw=new Set(b.split(/\W+/).filter(Boolean));
  let inter=0; aw.forEach(x=>{if(bw.has(x)) inter++});
  return inter/Math.max(1,Math.min(aw.size,bw.size));
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));}
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }

render();

window.RITTER_KASSE_LOADED = true;

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

console.log("Ritter-Kasse 3.10 (Build 20260701-006)");

