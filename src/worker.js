const WRITE_LIMIT_PER_MINUTE = 60;
const writes = new Map();
const statuses = new Set(["pending", "in_progress", "completed"]);
const priorities = new Set(["low", "medium", "high"]);
const headers = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cross-origin-resource-policy": "same-origin"
};
const reply = (body, status=200) => new Response(JSON.stringify(body), {status, headers: {"content-type":"application/json; charset=utf-8", ...headers}});
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const validTitle = (v) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 120 && !/[\x00-\x1f\x7f]/.test(v);
const validId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function readJson(request) {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return {error:"Se requiere Content-Type application/json.",status:415};
  if (!request.body || Number(request.headers.get("content-length") || 0) > 2048) return {error:"Cuerpo ausente o superior a 2 KB.",status:413};
  const reader=request.body.getReader(), chunks=[]; let size=0;
  try {
    while (true) {
      const part=await reader.read(); if (part.done) break;
      size+=part.value.byteLength;
      if(size>2048){ await reader.cancel(); return {error:"El cuerpo supera 2 KB.",status:413}; }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size); let offset=0;
  for(const chunk of chunks){ bytes.set(chunk,offset); offset+=chunk.byteLength; }
  try { const value=JSON.parse(new TextDecoder().decode(bytes)); return isObject(value)?{value}:{error:"El cuerpo JSON debe ser un objeto.",status:400}; }
  catch { return {error:"JSON inválido.",status:400}; }
}

async function rateAllowed(request) {
  const ip=request.headers.get("CF-Connecting-IP") || "local";
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));
  const key=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
  const now=Date.now(), entry=writes.get(key);
  if(!entry || entry.until<=now){ writes.set(key,{count:1,until:now+60000}); return true; }
  if(entry.count>=WRITE_LIMIT_PER_MINUTE) return false;
  entry.count++; return true;
}
const sameOrigin=(request,url)=>request.headers.get("origin")===url.origin;

async function health(env) {
  try { await env.DB.prepare("SELECT 1").first(); return reply({status:"ok",database:"connected"}); }
  catch { console.error(JSON.stringify({event:"database_health_error"})); return reply({status:"error",database:"unavailable"},503); }
}

async function api(request,env,url) {
  const path=url.pathname;
  if(request.method==="GET" && (path==="/health" || path==="/api/health")) return health(env);
  if(request.method==="GET" && path==="/api/stats"){
    const row=await env.DB.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(status='pending'),0) AS pending, COALESCE(SUM(status='in_progress'),0) AS in_progress, COALESCE(SUM(status='completed'),0) AS completed FROM tasks").first();
    return reply({total:row.total,pending:row.pending,in_progress:row.in_progress,completed:row.completed});
  }
  if(request.method==="GET" && path==="/api/tasks"){
    const status=url.searchParams.get("status")||"all", priority=url.searchParams.get("priority")||"all", search=(url.searchParams.get("q")||"").trim();
    if(status!=="all"&&!statuses.has(status)) return reply({error:"Filtro de estado inválido."},400);
    if(priority!=="all"&&!priorities.has(priority)) return reply({error:"Filtro de prioridad inválido."},400);
    if(search.length>120||/[\x00-\x1f\x7f]/.test(search)) return reply({error:"La búsqueda debe tener hasta 120 caracteres imprimibles."},400);
    const where=[], values=[];
    if(status!=="all"){where.push("status = ?");values.push(status);}
    if(priority!=="all"){where.push("priority = ?");values.push(priority);}
    if(search){where.push("instr(lower(title), lower(?)) > 0");values.push(search);}
    const sql="SELECT id,title,status,priority,created_at,updated_at FROM tasks"+(where.length?" WHERE "+where.join(" AND "):"")+" ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, updated_at DESC LIMIT 200";
    const result=await env.DB.prepare(sql).bind(...values).all();
    return reply({tasks:result.results});
  }
  if(path==="/api/tasks" && request.method==="POST"){
    if(!sameOrigin(request,url)) return reply({error:"Origen no permitido."},403);
    if(!(await rateAllowed(request))) return reply({error:"Límite temporal de escritura alcanzado."},429);
    const parsed=await readJson(request); if(parsed.error) return reply({error:parsed.error},parsed.status);
    const title=typeof parsed.value.title==="string"?parsed.value.title.trim():"";
    const status=parsed.value.status===undefined?"pending":parsed.value.status;
    const priority=parsed.value.priority===undefined?"medium":parsed.value.priority;
    if(!validTitle(title)) return reply({error:"El título debe tener entre 1 y 120 caracteres imprimibles."},400);
    if(!statuses.has(status)) return reply({error:"Estado inválido."},400);
    if(!priorities.has(priority)) return reply({error:"Prioridad inválida."},400);
    const id=crypto.randomUUID(), now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO tasks(id,title,status,priority,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(id,title,status,priority,now,now).run();
    return reply({task:{id,title,status,priority,created_at:now,updated_at:now}},201);
  }
  const match=path.match(/^\/api\/tasks\/([^/]+)$/);
  if(match&&!validId(match[1])) return reply({error:"Identificador inválido."},400);
  if(match&&request.method==="PATCH"){
    if(!sameOrigin(request,url)) return reply({error:"Origen no permitido."},403);
    if(!(await rateAllowed(request))) return reply({error:"Límite temporal de escritura alcanzado."},429);
    const parsed=await readJson(request); if(parsed.error) return reply({error:parsed.error},parsed.status);
    const set=[], values=[];
    if(Object.hasOwn(parsed.value,"title")){const title=typeof parsed.value.title==="string"?parsed.value.title.trim():"";if(!validTitle(title))return reply({error:"El título debe tener entre 1 y 120 caracteres imprimibles."},400);set.push("title = ?");values.push(title);}
    if(Object.hasOwn(parsed.value,"status")){if(!statuses.has(parsed.value.status))return reply({error:"Estado inválido."},400);set.push("status = ?");values.push(parsed.value.status);}
    if(Object.hasOwn(parsed.value,"priority")){if(!priorities.has(parsed.value.priority))return reply({error:"Prioridad inválida."},400);set.push("priority = ?");values.push(parsed.value.priority);}
    if(!set.length) return reply({error:"Incluye title, status o priority."},400);
    set.push("updated_at = ?");values.push(new Date().toISOString(),match[1]);
    const result=await env.DB.prepare("UPDATE tasks SET "+set.join(", ")+" WHERE id = ?").bind(...values).run();
    if(!result.meta.changes)return reply({error:"Tarea no encontrada."},404);
    const task=await env.DB.prepare("SELECT id,title,status,priority,created_at,updated_at FROM tasks WHERE id = ?").bind(match[1]).first();
    return reply({task});
  }
  if(match&&request.method==="DELETE"){
    if(!sameOrigin(request,url))return reply({error:"Origen no permitido."},403);
    if(!(await rateAllowed(request)))return reply({error:"Límite temporal de escritura alcanzado."},429);
    const result=await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(match[1]).run();
    if(!result.meta.changes)return reply({error:"Tarea no encontrada."},404);
    return reply({deleted:true,id:match[1]});
  }
  if(path.startsWith("/api/"))return reply({error:"Endpoint o método no permitido."},405);
  return null;
}

export default {
  async fetch(request,env){
    const started=Date.now(), requestId=crypto.randomUUID(), url=new URL(request.url);
    const route=url.pathname==="/api/tasks"?"tasks":url.pathname.startsWith("/api/tasks/")?"task_item":url.pathname==="/health"||url.pathname==="/api/health"?"health":url.pathname.split("/").slice(0,3).join("/");
    let response;
    try{response=await api(request,env,url);if(!response)response=await env.ASSETS.fetch(request);}
    catch(error){console.error(JSON.stringify({event:"request_error",requestId,route,error:error instanceof Error?error.name:"unknown"}));response=reply({error:"Error interno. Intenta más tarde.",requestId},500);}
    const outHeaders=new Headers(response.headers);
    for(const [key,value] of Object.entries(headers))outHeaders.set(key,value);
    outHeaders.set("x-request-id",requestId);
    const output=new Response(response.body,{status:response.status,headers:outHeaders});
    console.log(JSON.stringify({event:"http_request",requestId,method:request.method,route,status:output.status,durationMs:Date.now()-started}));
    return output;
  }
};
