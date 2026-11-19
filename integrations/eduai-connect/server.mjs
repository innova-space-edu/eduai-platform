import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createHandler } from './gateway.mjs';
const handler=createHandler({supabaseUrl:process.env.EDUAI_SUPABASE_URL,publishableKey:process.env.EDUAI_SUPABASE_PUBLISHABLE_KEY});
const port=Number(process.env.PORT||3334);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
const server=createServer({maxHeaderSize:16384,requestTimeout:20000,headersTimeout:10000},async(req,res)=>{
  try{
    if(!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400,{'Cache-Control':'no-store'});res.end();return;}
    const method=req.method||'GET';
    const init={method,headers:req.headers};
    if(!['GET','HEAD'].includes(method)){init.body=Readable.toWeb(req);init.duplex='half';}
    const response=await handler(new Request('http://127.0.0.1:'+port+req.url,init));
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{if(!res.headersSent)res.writeHead(500,{'Cache-Control':'no-store'});res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log('EDUAI Connect local listener ready on port '+port));
