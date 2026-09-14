/*
  AmbulanMu Godean - frontend GitHub Pages
  Ganti SCRIPT_URL dengan URL Web App Google Apps Script milik Anda.
*/
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwO_jWOg_Bi-TZa6a9bE-HPMWS3lh2LNKtyKiJg57bXReIivOfOknWPEHaPJ58CV_GY/exec";
const $ = id => document.getElementById(id);
const fmtRp = n => "Rp" + new Intl.NumberFormat("id-ID").format(Number(n||0));
const fmtNum = n => new Intl.NumberFormat("id-ID").format(Number(n||0));
const today = () => new Date().toISOString().slice(0,10);

let master = {crew:["Rehan"], purpose:["Jemput HD","Antar pasien","Jemput pasien","Lainnya"], vehicle:["R1","R2"]};
let todayReports = [];
let photoFiles = [];

function isConfigured(){ return SCRIPT_URL && !SCRIPT_URL.includes("PASTE_URL"); }
function setStatus(el,msg,ok=true){ el.textContent=msg; el.style.color=ok?"#198754":"#c0392b"; }
function localDateParts(d=new Date()){
  const days=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  return {day:days[d.getDay()], date:d.toISOString().slice(0,10)};
}
function populateSelect(id,items){
  const s=$(id); s.innerHTML="";
  [...new Set(items.filter(Boolean))].forEach(x=>{const o=document.createElement("option");o.value=x;o.textContent=x;s.appendChild(o)});
}
function init(){
  const p=localDateParts(); $("day").value=p.day; $("date").value=p.date; $("time").value=new Date().toTimeString().slice(0,5);
  $("dashDate").textContent=displayDate(p.date); $("rekapDate").value=p.date;
  populateSelect("crew",master.crew); populateSelect("purpose",master.purpose); populateSelect("vehicle",master.vehicle);
  loadMaster(); loadDashboard(p.date); photoInput();
}
function displayDate(s){return new Date(s+"T00:00:00").toLocaleDateString("id-ID",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})}
async function api(action, payload={}){
  if(!isConfigured()) throw new Error("URL Apps Script belum diisi di app.js.");
  const q=new URLSearchParams({action,...payload});
  const res=await fetch(SCRIPT_URL+"?"+q.toString(),{redirect:"follow"});
  const text=await res.text();
  let data; try{data=JSON.parse(text)}catch{throw new Error("Respons server bukan JSON: "+text.slice(0,180))}
  if(!data.ok) throw new Error(data.error||"Gagal");
  return data;
}
async function loadMaster(){
  try{
    const d=await api("getMaster");
    master=d.master||master;
    populateSelect("crew",master.crew);populateSelect("purpose",master.purpose);populateSelect("vehicle",master.vehicle);
    $("customCrew").value=master.crew.join("\n");$("customPurpose").value=master.purpose.join("\n");$("customVehicle").value=master.vehicle.join("\n");
  }catch(e){console.warn(e)}
}
function photoInput(){
  $("photos").addEventListener("change",()=>{
    photoFiles=[...$("photos").files];
    $("photoPreview").innerHTML="";
    photoFiles.forEach(f=>{const img=document.createElement("img");img.src=URL.createObjectURL(f);$("photoPreview").appendChild(img)});
  });
}
async function fileToBase64(file){
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
}
async function submitReport(e){
  e.preventDefault();
  const btn=$("submitBtn"); btn.disabled=true; btn.textContent="⏳ Menyimpan...";
  try{
    const photos=[];
    for(const f of photoFiles){photos.push({name:f.name,mime:f.type,data:await fileToBase64(f)})}
    const payload={
      date:$("date").value,time:$("time").value,day:$("day").value,purpose:$("purpose").value,
      patient:$("patient").value,address:$("address").value,pickup:$("pickup").value,destination:$("destination").value,
      vehicle:$("vehicle").value,crew:$("crew").value,km:$("km").value,cashIn:$("cashIn").value,cashOut:$("cashOut").value,
      cashNote:$("cashNote").value,note:$("note").value,photos:JSON.stringify(photos)
    };
    const d=await api("saveReport",payload);
    setStatus($("status"),"✅ Laporan tersimpan. "+(d.photoCount||0)+" foto berhasil diunggah.");
    $("reportForm").reset(); $("date").value=payload.date; $("time").value=new Date().toTimeString().slice(0,5);$("day").value=payload.day;
    $("cashIn").value=0;$("cashOut").value=0;$("photoPreview").innerHTML="";photoFiles=[];
    loadDashboard(payload.date);
  }catch(err){setStatus($("status"),"❌ "+err.message,false)}
  finally{btn.disabled=false;btn.textContent="🚑 Simpan Laporan"}
}
function renderReports(list,target){
  const box=$(target);box.innerHTML="";
  if(!list.length){box.innerHTML='<div class="muted">Belum ada laporan pada tanggal ini.</div>';return}
  list.forEach(r=>{
    const div=document.createElement("div");div.className="report";
    const photos=(r.photoUrls||[]).map(u=>`<a target="_blank" href="${u}">📷 Foto</a>`).join(" ");
    div.innerHTML=`<div class="report-head"><div><span class="report-name">${esc(r.patient)}</span><br><small>${esc(r.time)} • ${esc(r.purpose)} • ${esc(r.crew)} • ${esc(r.vehicle)}</small></div><b>${fmtRp(r.cashIn-r.cashOut)}</b></div>
      <div>${esc(r.pickup)} → ${esc(r.destination)} • ${fmtNum(r.km)} KM</div>
      <div class="report-actions"><button class="btn secondary copy-btn">📋 Copy WhatsApp</button><button class="btn secondary map-report">🗺️ Maps</button>${photos}</div>`;
    div.querySelector(".copy-btn").onclick=()=>copyWhatsApp(r);
    div.querySelector(".map-report").onclick=()=>openMaps(r.pickup,r.destination);
    box.appendChild(div);
  })
}
function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function copyWhatsApp(r){
  const s=`Laporan Layanan AmbulanMu Godean 

*Hari*               : *${r.day}* 

*Tanggal*        : *${r.dateDisplay}* 

*Waktu*            : *${r.time}wib* 

*Keperluan*     : *${r.purpose}* 

*Nama*             : *${r.patient}* 

*Alamat*           : *${r.address}* 

*Titik jemput*  : *${r.pickup}* 

*Titik Tujuan*  : *${r.destination}* 

*Armada*          : *${r.vehicle}* 

*Crew*               :  *${r.crew}* 

*Kas Masuk*     : *${fmtNum(r.cashIn)}* 

*Kas keluar*     :  *${fmtNum(r.cashOut)}* 

*Ket.Kas keluar*     :  *${r.cashNote||""}* 

*Note*               :  *${r.note||""}* 

*Jarak layanan* : *${fmtNum(r.km)} KM*

*Tetap semangat melayani umat*, 
*Memberi untuk Negeri*`;
  navigator.clipboard.writeText(s).then(()=>alert("Format WhatsApp berhasil disalin."));
}
function openMaps(a,b){window.open("https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(a)+"&destination="+encodeURIComponent(b),"_blank")}
function loadDashboard(date){
  $("dashDate").textContent=displayDate(date);
  api("getReports",{date}).then(d=>{
    todayReports=d.reports||[]; renderReports(todayReports,"todayList");
    const sums=todayReports.reduce((a,r)=>{a.in+=+r.cashIn||0;a.out+=+r.cashOut||0;a.km+=+r.km||0;return a},{in:0,out:0,km:0});
    $("statPatients").textContent=todayReports.length;$("statIn").textContent=fmtRp(sums.in);$("statOut").textContent=fmtRp(sums.out);$("statNet").textContent=fmtRp(sums.in-sums.out);$("statKm").textContent=fmtNum(sums.km)+" KM";
  }).catch(e=>console.warn(e));
}
$("reportForm").addEventListener("submit",submitReport);
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));$("tab-"+b.dataset.tab).classList.add("active")});
$("refreshDash").onclick=()=>loadDashboard($("date").value);
$("loadRekap").onclick=()=>api("getReports",{date:$("rekapDate").value}).then(d=>renderReports(d.reports||[],"rekapList")).catch(e=>alert(e.message));
$("exportExcel").onclick=()=>{const d=$("rekapDate").value; if(!isConfigured())return alert("Isi URL Apps Script dulu."); window.open(SCRIPT_URL+"?action=exportExcel&date="+encodeURIComponent(d),"_blank")};
$("openRoute").onclick=()=>openMaps($("pickup").value,$("destination").value);
document.querySelectorAll(".map-btn").forEach(b=>b.onclick=()=>{const id=b.dataset.map;const v=$(id).value;if(v)window.open("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(v),"_blank");else alert("Isi lokasi terlebih dahulu.")});
$("saveCustom").onclick=async()=>{
  try{
    const master2={crew:$("customCrew").value.split(/\n|,/).map(x=>x.trim()).filter(Boolean),purpose:$("customPurpose").value.split(/\n|,/).map(x=>x.trim()).filter(Boolean),vehicle:$("customVehicle").value.split(/\n|,/).map(x=>x.trim()).filter(Boolean)};
    await api("saveMaster",{master:JSON.stringify(master2)});master=master2;populateSelect("crew",master.crew);populateSelect("purpose",master.purpose);populateSelect("vehicle",master.vehicle);setStatus($("customStatus"),"✅ Master data tersimpan untuk semua driver.");
  }catch(e){setStatus($("customStatus"),"❌ "+e.message,false)}
};
$("btnYesterday").onclick=async()=>{
  const d=new Date();d.setDate(d.getDate()-1);const date=d.toISOString().slice(0,10);
  try{const x=await api("getReports",{date});const hd=(x.reports||[]).filter(r=>/HD/i.test(r.purpose));renderReports(hd,"todayList");alert(`Ditemukan ${hd.length} laporan HD kemarin.`)}catch(e){alert(e.message)}
};
$("btnDuplicate").onclick=async()=>{
  const d=new Date();d.setDate(d.getDate()-1);const date=d.toISOString().slice(0,10);
  try{
    const x=await api("getReports",{date});const hd=(x.reports||[]).filter(r=>/HD/i.test(r.purpose));
    if(!hd.length)return alert("Tidak ada laporan HD kemarin.");
    const names=hd.map((r,i)=>`${i+1}. ${r.patient}`).join("\n");const ans=prompt("Pilih nomor pasien HD kemarin:\n"+names);
    const i=Number(ans)-1;if(!hd[i])return;
    const r=hd[i];$("patient").value=r.patient;$("address").value=r.address;$("pickup").value=r.pickup;$("destination").value=r.destination;
    $("vehicle").value=r.vehicle;$("crew").value=r.crew;$("purpose").value=r.purpose;$("km").value=r.km;$("cashIn").value=r.cashIn;$("cashOut").value=r.cashOut;
    $("cashNote").value=r.cashNote||"";$("note").value=r.note||"";alert("Data pasien berhasil diduplikat. Silakan cek tanggal/waktu dan ubah yang perlu.");
  }catch(e){alert(e.message)}
};
init();
