/* AmbulanMu Godean - frontend */
const API_URL = 'https://script.google.com/macros/s/AKfycbza2vP60e3tVX_6Nl-w12MyaBepTpGE9d8_GXlEwCuuGVToQw8t3S32VpU7fxmkunNd2Q/exec';

const $ = id => document.getElementById(id);
const state = { masters:{keperluan:[],crew:[],armada:[]}, reports:[] };

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setToday();
  bindManualSelect('keperluan','keperluanManual');
  bindManualSelect('crew','crewManual');
  bindManualSelect('armada','armadaManual');
  document.querySelectorAll('.mapbtn').forEach(b=>b.onclick=()=>openMap($(b.dataset.map).value));
  $('reportForm').addEventListener('submit', saveReport);
  $('duplicateBtn').onclick = showYesterdayPatients;
  $('adminDate').value = $('tanggal').value;
  $('adminDate').onchange = loadDay;
  $('exportBtn').onclick = exportXlsx;
  $('saveMaster').onclick = saveMaster;
  $('closeModal').onclick = closePhoto;
  $('photoModal').onclick = e => { if(e.target.id==='photoModal') closePhoto(); };
  await loadMasters();
  await loadDay();
});

function apiAvailable(){ return API_URL && !API_URL.startsWith('GANTI_'); }

async function apiGet(action, params={}) {
  if(!apiAvailable()) throw new Error('URL Apps Script belum diisi di app.js.');
  const u = new URL(API_URL);
  u.searchParams.set('action',action);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const res = await fetch(u.toString(), {method:'GET',cache:'no-store'});
  const text = await res.text();
  return parseApi(text,res);
}
async function apiPost(payload) {
  if(!apiAvailable()) throw new Error('URL Apps Script belum diisi di app.js.');
  const res = await fetch(API_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  });
  const text=await res.text();
  return parseApi(text,res);
}
function parseApi(text,res){
  try { return JSON.parse(text); }
  catch(e) {
    const hint = text.includes('<!DOCTYPE') || text.includes('<html')
      ? 'Server mengembalikan HTML, bukan JSON. Pastikan URL di app.js adalah URL Web App /exec, bukan URL editor/test.'
      : 'Respons server bukan JSON: '+text.slice(0,180);
    throw new Error(hint+' HTTP '+res.status);
  }
}

function setupTabs(){
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active'); $(btn.dataset.tab).classList.add('active');
      if(btn.dataset.tab==='today') loadDay();
    };
  });
}
function setToday(){
  const d=new Date();
  const iso=localISO(d);
  $('tanggal').value=iso; $('adminDate').value=iso;
  $('waktu').value=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  updateDayName();
  $('tanggal').onchange=updateDayName;
}
function localISO(d){ const x=new Date(d.getTime()-d.getTimezoneOffset()*60000); return x.toISOString().slice(0,10); }
function updateDayName(){ const d=new Date($('tanggal').value+'T12:00:00'); $('hari').value=d.toLocaleDateString('id-ID',{weekday:'long'}); }

async function loadMasters(){
  try{
    const r=await apiGet('masters');
    if(!r.ok) throw new Error(r.error);
    state.masters=r.data||{};
    fillSelect('keperluan',state.masters.keperluan||[]);
    fillSelect('crew',state.masters.crew||[]);
    fillSelect('armada',state.masters.armada||[]);
  }catch(e){ setStatus('status',e.message,false); }
}
function fillSelect(id,items){
  const s=$(id); s.innerHTML='';
  items.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;s.appendChild(o)});
  const o=document.createElement('option');o.value='__manual__';o.textContent='✍️ Ketik lainnya…';s.appendChild(o);
}
function bindManualSelect(selectId,inputId){
  $(selectId).onchange=()=>$(inputId).classList.toggle('hidden',$(selectId).value!=='__manual__');
}
function valSelect(selectId,inputId){
  const v=$(selectId).value; return v==='__manual__'?$(inputId).value.trim():v;
}

function money(v){
  return String(v||'').replace(/[^\d]/g,'');
}
function rupiah(n){
  n=Number(n||0); return 'Rp'+new Intl.NumberFormat('id-ID').format(n);
}
function formatWa(r){
  const hari = r.hari || new Date(r.tanggal+'T12:00:00').toLocaleDateString('id-ID',{weekday:'long'});
  const kasIn = rupiah(r.kasMasuk||0).replace('Rp','');
  const kasOut = rupiah(r.kasKeluar||0).replace('Rp','');
  return `Laporan Layanan AmbulanMu Godean

*Hari*               : *${hari}*
*Tanggal*        : *${formatDate(r.tanggal)}*
*Waktu*            : *${r.waktu || ''}wib*
*Keperluan*     : *${r.keperluan || ''}*
*Nama*             : *${r.nama || ''}*
*Alamat*           : *${r.alamat || ''}*
*Titik jemput*  : *${r.titikJemput || ''}*
*Titik Tujuan*  : *${r.titikTujuan || ''}*
*Armada*          : *${r.armada || ''}*
*Crew*               :  *${r.crew || ''}*
*Kas Masuk*     : *${kasIn}*
*Kas keluar*     : *${kasOut}*
*Ket.Kas keluar*     : *${r.ketKasKeluar || ''}*
*Note*               : *${r.note || ''}*
*Jarak layanan* : *${Number(r.km||0).toFixed(1)} KM*

*Tetap semangat melayani umat*,
*Memberi untuk Negeri*`;
}
function formatDate(s){
  if(!s) return '';
  const [y,m,d]=s.split('-'); return `${d}-${m}-${y}`;
}
async function saveReport(e){
  e.preventDefault();
  const status=$('status'); setStatus('status','Mengirim laporan…',true);
  try{
    const f=$('foto').files[0];
    let fotoId='';
    if(f){
      if(f.size>5*1024*1024) throw new Error('Foto maksimal 5 MB.');
      const base64=await fileBase64(f);
      const up=await apiPost({action:'uploadPhoto',base64,mimeType:f.type,name:f.name});
      if(!up.ok) throw new Error(up.error||'Upload foto gagal');
      fotoId=up.data.id;
    }
    const r={
      tanggal:$('tanggal').value,hari:$('hari').value,waktu:$('waktu').value,
      keperluan:valSelect('keperluan','keperluanManual'),nama:$('nama').value.trim(),
      alamat:$('alamat').value.trim(),titikJemput:$('jemput').value.trim(),
      titikTujuan:$('tujuan').value.trim(),armada:valSelect('armada','armadaManual'),
      crew:valSelect('crew','crewManual'),kasMasuk:money($('kasMasuk').value),
      kasKeluar:money($('kasKeluar').value),ketKasKeluar:$('ketKasKeluar').value.trim(),
      note:$('note').value.trim(),km:$('km').value||0,fotoId
    };
    if(!r.keperluan||!r.nama||!r.alamat||!r.titikJemput||!r.titikTujuan||!r.armada||!r.crew) throw new Error('Mohon lengkapi kolom wajib.');
    const out=await apiPost({action:'saveReport',...r});
    if(!out.ok) throw new Error(out.error);
    const saved={...r,km:out.data.km||r.km, fotoUrl:out.data.photoUrl||''};
    showShare(saved);
    e.target.reset(); setToday();
    setStatus('status','Laporan berhasil disimpan.',true);
    await loadDay();
  }catch(err){ setStatus('status',err.message,false); }
}
function showShare(r){
  const text=formatWa(r);
  if(navigator.share) {
    navigator.share({title:'Laporan AmbulanMu Godean',text}).catch(()=>{});
  } else {
    navigator.clipboard?.writeText(text);
    alert('Laporan sudah disalin ke clipboard. Tempel di WhatsApp.');
  }
}
function fileBase64(file){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=reject; fr.readAsDataURL(file);
  });
}
function openMap(place){ if(!place) return alert('Isi lokasi dulu.'); window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place),'_blank'); }

async function loadDay(){
  const date=$('adminDate').value || $('tanggal').value || localISO(new Date());
  $('todayLabel').textContent='Rekap untuk '+formatDate(date);
  try{
    const [dash, reps]=await Promise.all([apiGet('dashboard',{date}),apiGet('reports',{date})]);
    if(!dash.ok) throw new Error(dash.error);
    const d=dash.data; $('sPatients').textContent=d.jumlahPasien; $('sIn').textContent=rupiah(d.kasMasuk);
    $('sOut').textContent=rupiah(d.kasKeluar); $('sBalance').textContent=rupiah(d.saldo); $('sKm').textContent=Number(d.totalKm||0).toFixed(1)+' km';
    state.reports=reps.data||[]; renderReports(state.reports);
  }catch(e){ $('reports').innerHTML='<div class="warning">'+escapeHtml(e.message)+'</div>'; }
}
function renderReports(rows){
  if(!rows.length){$('reports').innerHTML='<div class="report">Belum ada laporan pada tanggal ini.</div>';return;}
  $('reports').innerHTML=rows.map((r,i)=>`
    <article class="report">
      <div class="report-top"><h3>${escapeHtml(r.nama||'Tanpa nama')}</h3><b>${escapeHtml(r.waktu||'')}</b></div>
      <p><b>${escapeHtml(r.keperluan||'')}</b> • ${escapeHtml(r.crew||'')} • ${escapeHtml(r.armada||'')}</p>
      <p>${escapeHtml(r.titikJemput||'')} → ${escapeHtml(r.titikTujuan||'')}</p>
      <p>Kas: ${rupiah(r.kasMasuk)} masuk / ${rupiah(r.kasKeluar)} keluar • ${Number(r.km||0).toFixed(1)} km</p>
      <div class="actions">
        <button onclick="copyReport(${i})">📋 Salin WhatsApp</button>
        <button onclick="window.open('${r.mapsJemput||'#'}','_blank')">📍 Jemput</button>
        <button onclick="window.open('${r.mapsTujuan||'#'}','_blank')">📍 Tujuan</button>
        ${r.fotoUrl?`<button onclick="openPhoto('${r.fotoUrl}', '${escapeHtml(r.nama||'')}')">📷 Lihat Foto</button>`:''}
      </div>
    </article>`).join('');
}
async function copyReport(i){
  const text=formatWa(state.reports[i]);
  try{await navigator.clipboard.writeText(text);alert('Format WhatsApp berhasil disalin.');}
  catch(_){prompt('Salin teks berikut:',text);}
}
function showYesterdayPatients(){
  const d=new Date($('tanggal').value+'T12:00:00'); d.setDate(d.getDate()-1);
  const date=localISO(d);
  apiGet('reports',{date}).then(r=>{
    const list=(r.data||[]).filter(x=>x.keperluan==='Jemput HD' || /HD/i.test(x.keperluan||''));
    if(!list.length) return alert('Tidak ditemukan laporan HD kemarin.');
    const box=$('quickPatients'); box.classList.remove('hidden');
    box.innerHTML='<b>Pilih pasien HD:</b><br>'+list.map((x,i)=>`<button onclick="duplicatePatient(${i})">${escapeHtml(x.nama)}</button>`).join('');
    window._hdYesterday=list;
  }).catch(e=>alert(e.message));
}
window.duplicatePatient=i=>{
  const r=window._hdYesterday[i]; if(!r)return;
  $('keperluan').value=state.masters.keperluan.includes('Jemput HD')?'Jemput HD':'__manual__';
  $('keperluanManual').classList.add('hidden');
  $('nama').value=r.nama||'';$('alamat').value=r.alamat||'';$('jemput').value=r.titikJemput||'';
  $('tujuan').value=r.titikTujuan||'';$('armada').value=r.armada||'';$('crew').value=r.crew||'';
  $('kasMasuk').value=r.kasMasuk?new Intl.NumberFormat('id-ID').format(r.kasMasuk):'';
  $('kasKeluar').value=r.kasKeluar?new Intl.NumberFormat('id-ID').format(r.kasKeluar):'';
  $('ketKasKeluar').value=r.ketKasKeluar||'';$('note').value=r.note||'';$('km').value=r.km||'';
  $('quickPatients').classList.add('hidden');
  alert('Data pasien berhasil diduplikat. Silakan cek tanggal dan waktu sebelum menyimpan.');
};
async function exportXlsx(){
  const token=prompt('Masukkan Token Admin untuk export Excel (.xlsx):');
  if(!token) return;
  const date=$('adminDate').value || $('tanggal').value || localISO(new Date());
  try{
    const r=await apiPost({action:'exportXlsx',adminToken:token,date});
    if(!r.ok) throw new Error(r.error);
    window.open(r.data.url,'_blank');
  }catch(e){ alert('Export gagal: '+e.message); }
}
async function saveMaster(){
  const token=$('adminToken').value.trim(); if(!token) return setStatus('adminStatus','Token admin wajib diisi.',false);
  const master={
    keperluan:splitLines($('mKeperluan').value),crew:splitLines($('mCrew').value),armada:splitLines($('mArmada').value)
  };
  try{const r=await apiPost({action:'saveMaster',adminToken:token,master});if(!r.ok)throw new Error(r.error);setStatus('adminStatus','Master tersimpan dan akan terbaca perangkat lain.',true);await loadMasters();}
  catch(e){setStatus('adminStatus',e.message,false);}
}
function splitLines(s){return s.split(/\n|,/).map(x=>x.trim()).filter(Boolean)}
function openPhoto(url,caption){$('modalImg').src=url;$('modalCaption').textContent=caption||'';$('photoModal').classList.remove('hidden')}
function closePhoto(){$('modalImg').src='';$('photoModal').classList.add('hidden')}
function setStatus(id,msg,ok){$(id).textContent=msg;$(id).className='status '+(ok?'ok':'err')}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
