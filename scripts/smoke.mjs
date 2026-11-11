import assert from "node:assert/strict";

const base=(process.env.BASE_URL||"http://127.0.0.1:8787").replace(/\/$/,"");
const marker="capstone-"+Date.now();
let passes=0;
function check(value,label){assert.ok(value,label);passes++;console.log("PASS "+label);}
async function request(path,options={}){
  const response=await fetch(base+path,{...options,headers:{...(options.body?{"content-type":"application/json"}:{}),...(options.headers||{})}});
  const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{}
  return {response,data,text};
}
const health=await request("/health");
check(health.response.status===200&&health.data.status==="ok"&&health.data.database==="connected","/health reports Worker and D1 ready");
const apiHealth=await request("/api/health");
check(apiHealth.response.status===200&&apiHealth.data.database==="connected","/api/health compatibility route");
const page=await fetch(base);
check(page.status===200&&(await page.text()).includes("TaskFlow Cloud"),"TaskFlow Cloud static page");
check((await request("/api/tasks?status=invalid")).response.status===400,"invalid state filter rejected");
check((await request("/api/tasks?priority=urgent")).response.status===400,"invalid priority filter rejected");
check((await request("/api/tasks?q="+encodeURIComponent("x".repeat(121)))).response.status===400,"oversized search term rejected");
check((await request("/api/tasks",{method:"POST",headers:{origin:"https://attacker.invalid"},body:JSON.stringify({title:"blocked"})})).response.status===403,"cross-origin mutation rejected");
check((await request("/api/tasks",{method:"POST",headers:{origin:base,"content-type":"text/plain"},body:"{}"})).response.status===415,"unsupported content type rejected");
check((await request("/api/tasks",{method:"POST",headers:{origin:base,"content-type":"application/json"},body:"{"})).response.status===400,"malformed JSON rejected");
check((await request("/api/tasks",{method:"POST",headers:{origin:base},body:JSON.stringify({title:"x".repeat(2100)})})).response.status===413,"oversized request rejected");
check((await request("/api/tasks",{method:"POST",headers:{origin:base},body:JSON.stringify({title:" "})})).response.status===400,"blank title rejected");
check((await request("/api/tasks",{method:"POST",headers:{origin:base},body:JSON.stringify({title:"x",status:"unknown"})})).response.status===400,"invalid task state rejected");
check((await request("/api/tasks",{method:"POST",headers:{origin:base},body:JSON.stringify({title:"x",priority:"urgent"})})).response.status===400,"invalid task priority rejected");
check((await request("/api/tasks/not-a-uuid",{method:"PATCH",headers:{origin:base},body:JSON.stringify({status:"completed"})})).response.status===400,"invalid task identifier rejected");
check((await request("/api/tasks",{method:"PUT"})).response.status===405,"unsupported API method rejected");

const created=await request("/api/tasks",{method:"POST",headers:{origin:base},body:JSON.stringify({title:marker+" initial",status:"in_progress",priority:"high"})});
check(created.response.status===201&&created.data.task?.status==="in_progress"&&created.data.task?.priority==="high","create task with state and priority");
const id=created.data.task.id;
try{
  const all=await request("/api/tasks?status=all");
  check(all.response.status===200&&all.data.tasks.some((t)=>t.id===id),"list persisted task");
  const byStatus=await request("/api/tasks?status=in_progress");
  check(byStatus.data.tasks.some((t)=>t.id===id),"filter in-progress tasks");
  const byPriority=await request("/api/tasks?priority=high&q="+encodeURIComponent(marker));
  check(byPriority.data.tasks.some((t)=>t.id===id),"search and priority filter");
  const renamed=await request("/api/tasks/"+id,{method:"PATCH",headers:{origin:base},body:JSON.stringify({title:marker+" renamed"})});
  check(renamed.response.status===200&&renamed.data.task.title===marker+" renamed","edit task title");
  const completed=await request("/api/tasks/"+id,{method:"PATCH",headers:{origin:base},body:JSON.stringify({status:"completed"})});
  check(completed.response.status===200&&completed.data.task.status==="completed","update task state");
  const lowered=await request("/api/tasks/"+id,{method:"PATCH",headers:{origin:base},body:JSON.stringify({priority:"low"})});
  check(lowered.response.status===200&&lowered.data.task.priority==="low","update task priority");
  const combined=await request("/api/tasks?status=completed&priority=low&q="+encodeURIComponent(marker+" renamed"));
  check(combined.data.tasks.some((t)=>t.id===id),"combine state, priority and search filters");
  const stats=await request("/api/stats");
  check(stats.response.status===200&&Number.isInteger(stats.data.total)&&stats.data.total>=1&&Number.isInteger(stats.data.in_progress)&&Number.isInteger(stats.data.completed),"statistics endpoint returns all states");
}finally{
  const deleted=await request("/api/tasks/"+id,{method:"DELETE",headers:{origin:base}});
  check(deleted.response.status===200,"delete test task");
}
check((await request("/api/tasks/"+id,{method:"DELETE",headers:{origin:base}})).response.status===404,"missing task returns HTTP 404");
console.log("SMOKE_OK checks="+passes+" base="+base);
