const state={status:"all",priority:"all",search:"",tasks:[],busy:false};
const list=document.querySelector("#task-list"),empty=document.querySelector("#empty-state"),form=document.querySelector("#task-form");
const titleInput=document.querySelector("#task-title"),statusInput=document.querySelector("#task-status"),priorityInput=document.querySelector("#task-priority");
const searchInput=document.querySelector("#task-search"),priorityFilter=document.querySelector("#priority-filter");
const message=document.querySelector("#list-message"),toast=document.querySelector("#toast"),dialog=document.querySelector("#edit-dialog");
const editForm=document.querySelector("#edit-form"),editTitle=document.querySelector("#edit-title"),connection=document.querySelector("#connection-status");
const statusNames={pending:"Pendiente",in_progress:"En progreso",completed:"Completada"};
const priorityNames={low:"Baja",medium:"Media",high:"Alta"};
let toastTimer,searchTimer,editingId=null;

async function api(path,options={}){
  const headers={...(options.body?{"content-type":"application/json"}:{}),...(options.headers||{})};
  const response=await fetch(path,{...options,headers});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||"No se pudo completar la solicitud.");
  return body;
}
function notify(text,isError=false){
  toast.textContent=text;toast.classList.toggle("is-error",isError);toast.classList.add("is-visible");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("is-visible"),3000);
}
function makeSelect(entries,selected,label,className){
  const select=document.createElement("select");select.className=className;select.setAttribute("aria-label",label);
  for(const [value,text] of entries){const option=document.createElement("option");option.value=value;option.textContent=text;option.selected=value===selected;select.append(option);}
  return select;
}
function render(){
  list.replaceChildren();
  for(const task of state.tasks){
    const row=document.createElement("li");row.className="task-row";row.dataset.id=task.id;
    const main=document.createElement("div");main.className="task-main";
    const marker=document.createElement("span");marker.className="task-marker marker-"+task.status;marker.setAttribute("aria-hidden","true");
    const copy=document.createElement("div");copy.className="task-copy";
    const title=document.createElement("strong");title.className="task-title"+(task.status==="completed"?" is-completed":"");title.textContent=task.title;
    const time=document.createElement("time");time.className="task-date";time.dateTime=task.updated_at;
    time.textContent="Actualizada "+new Intl.DateTimeFormat("es",{dateStyle:"medium"}).format(new Date(task.updated_at));
    copy.append(title,time);main.append(marker,copy);
    const controls=document.createElement("div");controls.className="task-controls";
    const status=makeSelect(Object.entries(statusNames),task.status,"Estado de "+task.title,"task-select status-select");status.dataset.change="status";
    const priority=makeSelect(Object.entries(priorityNames),task.priority,"Prioridad de "+task.title,"task-select priority-select priority-"+task.priority);priority.dataset.change="priority";
    const edit=document.createElement("button");edit.type="button";edit.className="icon-button";edit.dataset.action="edit";edit.title="Editar título";edit.textContent="✎";edit.setAttribute("aria-label","Editar "+task.title);
    const remove=document.createElement("button");remove.type="button";remove.className="icon-button delete-button";remove.dataset.action="delete";remove.title="Eliminar tarea";remove.textContent="×";remove.setAttribute("aria-label","Eliminar "+task.title);
    controls.append(status,priority,edit,remove);row.append(main,controls);list.append(row);
  }
  empty.classList.toggle("is-visible",state.tasks.length===0);
  document.querySelector("#task-count").textContent=state.tasks.length+(state.tasks.length===1?" tarea":" tareas");
}
async function refresh(){
  const params=new URLSearchParams({status:state.status,priority:state.priority});if(state.search)params.set("q",state.search);
  const result=await Promise.all([api("/api/tasks?"+params),api("/api/stats")]);
  state.tasks=result[0].tasks;render();
  document.querySelector("#stat-total").textContent=result[1].total;
  document.querySelector("#stat-pending").textContent=result[1].pending;
  document.querySelector("#stat-progress").textContent=result[1].in_progress;
  document.querySelector("#stat-completed").textContent=result[1].completed;
  message.textContent="Guardado en la base de datos D1";
  connection.classList.remove("is-offline");connection.lastElementChild.textContent="Conectado";
}
function setStatusFilter(status){
  state.status=status;
  for(const button of document.querySelectorAll("[data-status]")){
    const active=button.dataset.status===status;button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",String(active));
  }
}
form.addEventListener("submit",async(event)=>{
  event.preventDefault();if(state.busy)return;state.busy=true;
  try{
    await api("/api/tasks",{method:"POST",body:JSON.stringify({title:titleInput.value.trim(),status:statusInput.value,priority:priorityInput.value})});
    form.reset();statusInput.value="pending";priorityInput.value="medium";
    if(state.status!=="all"&&state.status!=="pending")setStatusFilter("pending");
    await refresh();notify("Tarea guardada en D1");titleInput.focus();
  }catch(error){notify(error.message,true);}finally{state.busy=false;}
});
document.querySelector(".filters").addEventListener("click",async(event)=>{
  const button=event.target.closest("[data-status]");if(!button)return;setStatusFilter(button.dataset.status);
  try{await refresh();}catch(error){connection.classList.add("is-offline");notify(error.message,true);}
});
priorityFilter.addEventListener("change",async()=>{state.priority=priorityFilter.value;try{await refresh();}catch(error){notify(error.message,true);}});
searchInput.addEventListener("input",()=>{
  clearTimeout(searchTimer);searchTimer=setTimeout(async()=>{state.search=searchInput.value.trim();try{await refresh();}catch(error){notify(error.message,true);}},220);
});
list.addEventListener("change",async(event)=>{
  const control=event.target.closest("[data-change]"),row=event.target.closest(".task-row");
  if(!control||!row||state.busy)return;state.busy=true;
  try{
    const patch={};patch[control.dataset.change]=control.value;
    await api("/api/tasks/"+encodeURIComponent(row.dataset.id),{method:"PATCH",body:JSON.stringify(patch)});
    await refresh();notify("Cambios guardados");
  }catch(error){notify(error.message,true);await refresh().catch(()=>{});}finally{state.busy=false;}
});
list.addEventListener("click",async(event)=>{
  const button=event.target.closest("[data-action]"),row=event.target.closest(".task-row");
  if(!button||!row||state.busy)return;
  if(button.dataset.action==="edit"){
    const task=state.tasks.find((item)=>item.id===row.dataset.id);if(!task)return;
    editingId=task.id;editTitle.value=task.title;dialog.showModal();editTitle.focus();return;
  }
  state.busy=true;
  try{await api("/api/tasks/"+encodeURIComponent(row.dataset.id),{method:"DELETE"});await refresh();notify("Tarea eliminada");}
  catch(error){notify(error.message,true);}finally{state.busy=false;}
});
editForm.addEventListener("submit",async(event)=>{
  event.preventDefault();if(!editingId||state.busy)return;state.busy=true;
  try{await api("/api/tasks/"+encodeURIComponent(editingId),{method:"PATCH",body:JSON.stringify({title:editTitle.value.trim()})});dialog.close();await refresh();notify("Título actualizado");}
  catch(error){notify(error.message,true);}finally{state.busy=false;}
});
document.querySelector("#cancel-edit").addEventListener("click",()=>dialog.close());
document.querySelector("#close-edit").addEventListener("click",()=>dialog.close());
refresh().catch((error)=>{
  connection.classList.add("is-offline");connection.lastElementChild.textContent="Sin conexión";
  message.textContent="No se pudo conectar con el servicio.";notify(error.message,true);
});
