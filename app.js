const API_URL = 'https://script.google.com/macros/s/AKfycbx2CzAo9upkpddYsHE0Tk1VBRUrw0lJLOmgt6_4QnG_vQwl8QcG-yi6Qjm1sJAKpxRy/exec';

const KEY = 'amgodean_demo_v1';

const DEFAULT_MASTER = {
  crew: ['Rehan','David','Halim','Furi','Wahid'],
  armada: ['R1','R2'],
  keperluan: [
    'Jemput HD',
    'Antar HD',
    'Rujukan',
    'Antar/Jemput Pasien',
    'Laka',
    'Kontrol',
    'Jenazah',
    'Lainnya'
  ]
};

let saved = JSON.parse(localStorage.getItem(KEY) || 'null');

let state = {
  master: {
    crew: saved?.master?.crew?.length ? saved.master.crew : [...DEFAULT_MASTER.crew],
    armada: saved?.master?.armada?.length ? saved.master.armada : [...DEFAULT_MASTER.armada],
    keperluan: saved?.master?.keperluan?.length ? saved.master.keperluan : [...DEFAULT_MASTER.keperluan]
  },
  reports: Array.isArray(saved?.reports) ? saved.reports : []
};

const $ = id => document.getElementById(id);

const save = () => {
  localStorage.setItem(KEY, JSON.stringify(state));
};

const iso = () => {
  let d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
};

const fd = s => {
  if(!s) return '';
  let [y,m,d] = s.split('-');
  return d + '-' + m + '-' + y;
};

const rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');

const esc = s => String(s ?? '').replace(
  /[&<>"']/g,
  x => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[x])
);

function setOpts(id, arr){
  const el = $(id);
  if(!el) return;

  el.innerHTML =
    '<option value="">Pilih...</option>' +
    arr.map(x => '<option value="' + esc(x) + '">' + esc(x) + '</option>').join('');
}

function master(){

  setOpts('keperluan', state.master.keperluan);
  setOpts('armada', state.master.armada);
  setOpts('crew', state.master.crew);

  if($('mCrew'))
    $('mCrew').value = state.master.crew.join('\n');

  if($('mArmada'))
    $('mArmada').value = state.master.armada.join('\n');

  if($('mKeperluan'))
    $('mKeperluan').value = state.master.keperluan.join('\n');
}

function hari(){
  let d = $('tanggal').value;

  return d
    ? new Intl.DateTimeFormat('id-ID',{
        weekday:'long'
      }).format(new Date(d + 'T12:00:00'))
    : '';
}

function today(){

  let t = iso();

  $('tanggal').value = t;
  $('hari').value = hari();

  $('waktu').value =
    new Date().toLocaleTimeString('id-ID',{
      hour:'2-digit',
      minute:'2-digit',
      hour12:false
    });

  $('dari').value = t;
  $('sampai').value = t;
}

function data(){

  return {
    id: crypto.randomUUID(),

    hari: $('hari').value,
    tanggal: $('tanggal').value,
    waktu: $('waktu').value,

    keperluan: $('keperluan').value,
    nama: $('nama').value.trim(),
    alamat: $('alamat').value.trim(),

    jemput: $('jemput').value.trim(),
    tujuan: $('tujuan').value.trim(),

    armada: $('armada').value,
    crew: $('crew').value,

    kasMasuk: +$('masuk').value || 0,
    kasKeluar: +$('keluar').value || 0,

    ketKasKeluar: $('ket').value.trim(),

    km: +$('km').value || 0,

    note: $('note').value.trim(),

    foto: $('preview').src || ''
  };
}

async function apiGet(action){

  const res = await fetch(
    API_URL + '?action=' + encodeURIComponent(action)
  );

  const text = await res.text();

  let result;

  try{
    result = JSON.parse(text);
  }catch(e){
    throw new Error(
      'Respons server bukan JSON: ' +
      text.slice(0,200)
    );
  }

  if(!result.ok){
    throw new Error(
      result.error || 'Server error'
    );
  }

  return result;
}

async function loadCloud(){

  try{

    const reportsData = await apiGet('reports');
    const masterData = await apiGet('master');

    const cloudReports = reportsData.reports || [];

    // Simpan laporan yang saat ini ada di browser
    const localReports = Array.isArray(state.reports)
      ? state.reports
      : [];

    // Gabungkan data Google Sheet + data lokal
    // ID yang sama tidak akan dibuat dua kali
    const combined = new Map();

    cloudReports.forEach(r => {
      if(r.id){
        combined.set(String(r.id), r);
      }
    });

    localReports.forEach(r => {
      if(r.id){
        combined.set(String(r.id), {
          ...combined.get(String(r.id)),
          ...r
        });
      }
    });

    state.reports = Array.from(combined.values());

    // Master dari Google Spreadsheet
    if(masterData.master){

      if(
        Array.isArray(masterData.master.crew) &&
        masterData.master.crew.length > 0
      ){
        state.master.crew = masterData.master.crew;
      }

      if(
        Array.isArray(masterData.master.armada) &&
        masterData.master.armada.length > 0
      ){
        state.master.armada = masterData.master.armada;
      }

      if(
        Array.isArray(masterData.master.keperluan) &&
        masterData.master.keperluan.length > 0
      ){
        state.master.keperluan = masterData.master.keperluan;
      }

    }

    save();
    master();
    render();

    console.log(
      'Data cloud berhasil dimuat:',
      cloudReports.length
    );

  }catch(err){

    console.error(
      'Gagal mengambil data online:',
      err
    );

    // Jika gagal membaca server,
    // jangan hapus data yang sudah tampil.
    master();
    render();
  }
}

async function saveCloud(report){

  const payload = {
    action: 'saveReport',

    report: {
      ...report,
      photoBase64: report.foto || '',
      photoMime: 'image/jpeg'
    }
  };

  await fetch(API_URL,{
    method:'POST',
    mode:'no-cors',

    headers:{
      'Content-Type':'text/plain;charset=utf-8'
    },

    body:JSON.stringify(payload)
  });
}
function data(){return{id:crypto.randomUUID(),hari:$('hari').value,tanggal:$('tanggal').value,waktu:$('waktu').value,keperluan:$('keperluan').value,nama:$('nama').value.trim(),alamat:$('alamat').value.trim(),jemput:$('jemput').value.trim(),tujuan:$('tujuan').value.trim(),armada:$('armada').value,crew:$('crew').value,kasMasuk:+$('masuk').value||0,kasKeluar:+$('keluar').value||0,ketKasKeluar:$('ket').value.trim(),km:+$('km').value||0,note:$('note').value.trim(),foto:$('preview').src||''}}
function wa(r){return`Laporan Layanan AmbulanMu Godean\n\n*Hari*\n: *${r.hari}*\n\n*Tanggal* : *${fd(r.tanggal)}*\n\n*Waktu*\n: *${r.waktu}wib*\n\n*Keperluan* : *${r.keperluan}*\n\n*Nama*\n: *${r.nama}*\n\n*Alamat*\n: *${r.alamat||'-'}*\n\n*Titik jemput* : *${r.jemput||'-'}*\n\n*Titik Tujuan* : *${r.tujuan||'-'}*\n\n*Armada* : *${r.armada}*\n\n*Crew*\n: *${r.crew}*\n\n*Kas Masuk* : *${rp(r.kasMasuk)}*\n\n*Kas keluar* : *${rp(r.kasKeluar)}*\n\n*Ket.Kas keluar* : *${r.ketKasKeluar||'-'}*\n\n*Note*\n: *${r.note||'-'}*\n\n*Jarak Tempuh* : *${r.km||0} KM*\n\n*Tetap semangat melayani umat*,\n\n*Memberi untuk Negeri*`}
async function copy(t){try{await navigator.clipboard.writeText(t);alert('Format WhatsApp sudah disalin.')}catch(e){prompt('Salin teks berikut:',t)}}
function filtered(){let a=$('dari').value,b=$('sampai').value,q=$('cari').value.toLowerCase();return state.reports.filter(r=>(!a||r.tanggal>=a)&&(!b||r.tanggal<=b)&&(!q||[r.nama,r.crew,r.tujuan,r.jemput,r.keperluan].join(' ').toLowerCase().includes(q))).sort((x,y)=>(y.tanggal+y.waktu).localeCompare(x.tanggal+x.waktu))}
function render(){let a=filtered(),mi=0,mo=0,km=0;a.forEach(r=>{mi+=r.kasMasuk;mo+=r.kasKeluar;km+=r.km});$('sLayanan').textContent=a.length;$('sMasuk').textContent=rp(mi);$('sKeluar').textContent=rp(mo);$('sSaldo').textContent=rp(mi-mo);$('sKm').textContent=km+' KM';$('rows').innerHTML=a.length?a.map(r=>`<tr><td>${fd(r.tanggal)}</td><td>${r.waktu} WIB</td><td><b>${esc(r.nama)}</b></td><td>${esc(r.keperluan)}</td><td>${esc(r.jemput)} → ${esc(r.tujuan)}</td><td>${esc(r.armada)}</td><td>${esc(r.crew)}</td><td>${rp(r.kasMasuk)}<br>keluar ${rp(r.kasKeluar)}</td><td>${r.km} KM</td><td><button class="mini" onclick="copyOne('${r.id}')">WA</button>${r.foto?`<button class="mini" onclick="photo('${r.id}')">📷</button>`:''}</td></tr>`).join(''):'<tr><td colspan="10" style="text-align:center;padding:30px">Belum ada laporan.</td></tr>'}
function copyOne(id){let r=state.reports.find(x=>x.id===id);if(r)copy(wa(r))}
function photo(id){let r=state.reports.find(x=>x.id===id);if(r){$('mtitle').textContent='Dokumentasi Foto';$('mbody').innerHTML='<img src="'+r.foto+'" style="width:100%;border-radius:12px">';$('modal').classList.remove('hide')}}
function quick(){let d=new Date();d.setDate(d.getDate()-1);let y=d.toISOString().slice(0,10),a=state.reports.filter(r=>r.tanggal===y&&/hd/i.test(r.keperluan));if(!a.length)return alert('Tidak ditemukan laporan HD kemarin.');$('mtitle').textContent='Pilih pasien HD kemarin';$('mbody').innerHTML=a.map(r=>`<div class="choice"><span><b>${esc(r.nama)}</b><br><small>${esc(r.keperluan)} · ${esc(r.tujuan)}</small></span><button onclick="dup('${r.id}')">Duplikat</button></div>`).join('');$('modal').classList.remove('hide')}
function dup(id){let r=state.reports.find(x=>x.id===id);if(!r)return;$('tanggal').value=iso();$('hari').value=hari();['keperluan','nama','alamat','jemput','tujuan','armada','crew','ket','note'].forEach(k=>{let map={ket:'ketKasKeluar',note:'note'};$(k).value=r[map[k]||k]||''});$('masuk').value=r.kasMasuk||0;$('keluar').value=r.kasKeluar||0;$('km').value=r.km||0;$('modal').classList.add('hide');window.scrollTo({top:0,behavior:'smooth'});alert('Laporan kemarin sudah diduplikat. Periksa waktu, kas dan KM sebelum menyimpan.')}
$('tanggal').onchange=()=>$('hari').value=hari();
$('form').onsubmit = async e => {
  e.preventDefault();

  let r = data();

  if(!r.nama || !r.keperluan || !r.armada || !r.crew){
    return alert('Lengkapi kolom wajib.');
  }

  const btn = $('form').querySelector('button[type="submit"]');

  if(btn){
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
  }

  try{
    await saveCloud(r);

    // Simpan sementara juga di browser ini
    state.reports.push(r);
    save();

    alert('Laporan berhasil dikirim ke Google Spreadsheet.');

    e.target.reset();
    $('preview').src = '';
    $('preview').classList.add('hide');

    today();
    master();
    render();

   

  }catch(err){
    console.error(err);
    alert('Gagal mengirim laporan: ' + err.message);
  }finally{
    if(btn){
      btn.disabled = false;
      btn.textContent = 'Simpan Laporan';
    }
  }
};
$('form').onreset=()=>setTimeout(()=>{today();master()},0);
$('foto').onchange=e=>{let f=e.target.files[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{$('preview').src=rd.result;$('preview').classList.remove('hide')};rd.readAsDataURL(f)};
$('route').onclick=()=>{if(!$('jemput').value||!$('tujuan').value)return alert('Isi Titik Jemput dan Titik Tujuan.');location.href='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent($('jemput').value)+'&destination='+encodeURIComponent($('tujuan').value)};
$('tujuanMap').onclick=()=>{if(!$('tujuan').value)return alert('Isi Titik Tujuan.');location.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent($('tujuan').value)};
$('quickHd').onclick=quick;$('refresh').onclick = async () => {
  $('refresh').textContent = '⟳ Memuat...';

  try {
    await loadCloud();
  } finally {
    $('refresh').textContent = '⟳ Muat ulang';
  }
};
$('filter').onclick=render;$('copyAll').onclick=()=>{let a=filtered();if(a.length)copy(a.map(wa).join('\n\n━━━━━━━━━━━━\n\n'));else alert('Tidak ada laporan.')};
$('excel').onclick=()=>{let a=filtered().map(r=>({Tanggal:fd(r.tanggal),Hari:r.hari,Waktu:r.waktu+' WIB',Nama:r.nama,Keperluan:r.keperluan,Alamat:r.alamat,'Titik Jemput':r.jemput,'Titik Tujuan':r.tujuan,Armada:r.armada,Crew:r.crew,'Kas Masuk':r.kasMasuk,'Kas Keluar':r.kasKeluar,'Ket Kas Keluar':r.ketKasKeluar,KM:r.km,Note:r.note,Foto:r.foto?'Ada':''}));if(!a.length)return alert('Tidak ada data.');let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(a),'Laporan');XLSX.writeFile(wb,'Rekap_AmbulanMu_'+iso()+'.xlsx')};
$('saveMaster').onclick=()=>{state.master.crew=$('mCrew').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);state.master.armada=$('mArmada').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);state.master.keperluan=$('mKeperluan').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);save();master();alert('Master tersimpan di browser ini. Backend terpusat dipasang pada tahap berikutnya.')};
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$('page-'+b.dataset.page).classList.add('active');if(b.dataset.page==='rekap')render()});
$('close').onclick=()=>$('modal').classList.add('hide');$('modal').onclick=e=>{if(e.target===$('modal'))$('modal').classList.add('hide')};
today();
master();
render();
loadCloud();
