const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form=document.getElementById("studentForm");
const editId=document.getElementById("editId");
const studentId=document.getElementById("studentId");
const fullName=document.getElementById("fullName");
const course=document.getElementById("course");
const yearLevel=document.getElementById("yearLevel");
const email=document.getElementById("email");
const submitBtn=document.getElementById("submitBtn");
const cancelBtn=document.getElementById("cancelBtn");
const refreshBtn=document.getElementById("refreshBtn");
const exportBtn=document.getElementById("exportBtn");
const searchInput=document.getElementById("searchInput");
const tableBody=document.getElementById("studentTableBody");
const studentCount=document.getElementById("studentCount");
const message=document.getElementById("message");
const formTitle=document.getElementById("formTitle");
const lastUpdated=document.getElementById("lastUpdated");
const connectionStatus=document.getElementById("connectionStatus");
const statusText=document.getElementById("statusText");
const realtimeStatus=document.getElementById("realtimeStatus");

let students=[];
let realtimeChannel=null;

document.addEventListener("DOMContentLoaded",async()=>{
  await testConnection();
  await loadStudents();
  subscribeToRealtime();
});
form.addEventListener("submit",handleSubmit);
cancelBtn.addEventListener("click",resetForm);
refreshBtn.addEventListener("click",loadStudents);
exportBtn.addEventListener("click",exportCSV);
searchInput.addEventListener("input",renderStudents);

async function testConnection(){
  if(!SUPABASE_URL||SUPABASE_URL.includes("PASTE_YOUR")||!SUPABASE_ANON_KEY||SUPABASE_ANON_KEY.includes("PASTE_YOUR")){
    setConnection(false,"Configure Supabase");
    setMessage("Open config.js and paste your Supabase Project URL and Publishable/Anon key.",true);
    return;
  }
  const {error}=await db.from("students").select("id",{count:"exact",head:true});
  if(error){setConnection(false,"Database Error");console.error(error);setMessage(error.message,true);return}
  setConnection(true,"Database Connected");
}
function setConnection(online,text){
  connectionStatus.classList.toggle("status-online",online);
  connectionStatus.classList.toggle("status-offline",!online);
  statusText.textContent=text;
}
async function loadStudents(){
  const {data,error}=await db.from("students").select("*").order("created_at",{ascending:false});
  if(error){console.error(error);tableBody.innerHTML='<tr><td colspan="7" class="empty">Unable to load records.</td></tr>';setMessage(error.message,true);return}
  students=data||[];renderStudents();updateLastUpdated();
}
function renderStudents(){
  const query=searchInput.value.trim().toLowerCase();
  const filtered=students.filter(s=>[s.student_id,s.full_name,s.course,s.year_level,s.email].some(v=>String(v??"").toLowerCase().includes(query)));
  studentCount.textContent=students.length;
  if(!filtered.length){tableBody.innerHTML='<tr><td colspan="7" class="empty">No student records found.</td></tr>';return}
  tableBody.innerHTML=filtered.map(s=>`<tr>
    <td>${escapeHTML(s.student_id)}</td><td>${escapeHTML(s.full_name)}</td><td>${escapeHTML(s.course)}</td>
    <td>${escapeHTML(s.year_level)}</td><td>${escapeHTML(s.email)}</td><td>${formatDate(s.created_at)}</td>
    <td><div class="actions"><button class="btn secondary small" onclick="startEdit('${s.id}')">Edit</button>
    <button class="btn danger small" onclick="deleteStudent('${s.id}')">Delete</button></div></td>
  </tr>`).join("");
}
async function handleSubmit(e){
  e.preventDefault();
  const payload={student_id:studentId.value.trim(),full_name:fullName.value.trim(),course:course.value.trim(),year_level:yearLevel.value,email:email.value.trim()};
  if(Object.values(payload).some(v=>!v)){setMessage("Please complete all fields.",true);return}
  submitBtn.disabled=true;
  let error;
  if(editId.value){
    ({error}=await db.from("students").update(payload).eq("id",editId.value));
  }else{
    ({error}=await db.from("students").insert([payload]));
  }
  submitBtn.disabled=false;
  if(error){console.error(error);setMessage(error.message,true);return}
  setMessage(editId.value?"Student record updated successfully.":"Student registered successfully.",false);
  resetForm();
  await loadStudents();
}
window.startEdit=function(id){
  const s=students.find(x=>String(x.id)===String(id));if(!s)return;
  editId.value=s.id;studentId.value=s.student_id;fullName.value=s.full_name;course.value=s.course;yearLevel.value=s.year_level;email.value=s.email;
  formTitle.textContent="Edit Student";submitBtn.textContent="Update Student";cancelBtn.classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
};
window.deleteStudent=async function(id){
  const s=students.find(x=>String(x.id)===String(id));if(!s)return;
  if(!confirm(`Delete the record of ${s.full_name}?`))return;
  const {data,error}=await db.from("students").delete().eq("id",id).select();
  if(error){console.error(error);setMessage(error.message,true);return}
  if(!data||data.length===0){setMessage("Delete blocked: no permission to delete this record (check Supabase RLS policy).",true);return}
  setMessage("Student record deleted successfully.",false);await loadStudents();
};
function resetForm(){form.reset();editId.value="";formTitle.textContent="Register Student";submitBtn.textContent="Register Student";cancelBtn.classList.add("hidden")}
function setMessage(text,isError){message.textContent=text;message.className=`message ${isError?"error":"success"}`}
function formatDate(v){return v?new Date(v).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"}):"-"}
function updateLastUpdated(){lastUpdated.textContent=`Last updated: ${new Date().toLocaleTimeString("en-PH")}`}
function escapeHTML(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}

function subscribeToRealtime(){
  if(!SUPABASE_URL||SUPABASE_URL.includes("PASTE_YOUR")||!SUPABASE_ANON_KEY||SUPABASE_ANON_KEY.includes("PASTE_YOUR")){realtimeStatus.textContent="Not configured";return}
  if(realtimeChannel)db.removeChannel(realtimeChannel);
  realtimeChannel=db.channel("students-realtime")
    .on("postgres_changes",{event:"*",schema:"public",table:"students"},async payload=>{
      console.log("Realtime database change:",payload);
      await loadStudents();
      setMessage(`Realtime update received: ${payload.eventType||"CHANGE"}`,false);
    })
    .subscribe(status=>{
      console.log("Realtime status:",status);
      if(status==="SUBSCRIBED"){realtimeStatus.textContent="Connected";setConnection(true,"Database + Realtime Connected")}
      else if(status==="CHANNEL_ERROR")realtimeStatus.textContent="Error";
      else if(status==="TIMED_OUT")realtimeStatus.textContent="Timed out";
      else if(status==="CLOSED")realtimeStatus.textContent="Closed";
      else realtimeStatus.textContent=status;
    });
}
function exportCSV(){
  if(!students.length){setMessage("There are no records to export.",true);return}
  const headers=["Student ID","Full Name","Course","Year Level","Email","Created At"];
  const rows=students.map(s=>[s.student_id,s.full_name,s.course,s.year_level,s.email,s.created_at]);
  const csv=[headers,...rows].map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a=document.createElement("a");a.href=url;a.download="student-records.csv";a.click();URL.revokeObjectURL(url);
  setMessage("Student records exported as CSV.",false);
}
