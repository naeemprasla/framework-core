function pgUrl({host,port,database,user,password,ssl}){
  host=String(host||"localhost").trim();database=String(database||"").trim();user=String(user||"").trim();
  if(!host||!database||!user)throw new Error("Database host, name and username are required");
  const u=new URL("postgresql://localhost");u.hostname=host;u.port=String(Number(port)||5432);u.pathname=`/${encodeURIComponent(database)}`;u.username=user;u.password=String(password||"");
  if(ssl)u.searchParams.set("sslmode","require");return u.toString();
}
export function createPostgresConnectionUrl(input={}){return input.database_url||pgUrl({host:input.host,port:input.port,database:input.database,user:input.username,password:input.password,ssl:input.ssl===true||input.ssl==="true"});}
export function normalizeSupabaseDirectUrl(input){
  const raw=String(input||"").trim();if(!raw)throw new Error("Supabase direct connection string is required");
  let url;try{url=new URL(raw);}catch{throw new Error("Supabase connection string is invalid");}
  if(!["postgresql:","postgres:"].includes(url.protocol))throw new Error("Supabase connection must use postgres:// or postgresql://");
  const host=url.hostname.toLowerCase();
  if(host.includes("pooler.supabase.com")||url.port==="6543")throw new Error("Use the Supabase Direct Connection, not a pooler connection");
  if(!/^db\.[a-z0-9-]+\.supabase\.co$/i.test(host))throw new Error("Supabase Direct Connection host must look like db.<project-ref>.supabase.co");
  if(url.port&&url.port!=="5432")throw new Error("Supabase Direct Connection must use port 5432");
  url.port="5432";if(!url.username)url.username="postgres";if(!url.pathname||url.pathname==="/")url.pathname="/postgres";url.searchParams.set("sslmode","require");return url.toString();
}
export function createSupabaseDirectUrl({database_url,project_ref,password,database="postgres"}={}){
  if(database_url)return normalizeSupabaseDirectUrl(database_url);
  const ref=String(project_ref||"").trim().toLowerCase();if(!/^[a-z0-9-]{8,64}$/.test(ref))throw new Error("Enter a valid Supabase project reference");
  return pgUrl({host:`db.${ref}.supabase.co`,port:5432,database:database||"postgres",user:"postgres",password,ssl:true});
}
