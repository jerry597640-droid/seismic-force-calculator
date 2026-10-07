const fs=require('fs'),path=require('path'),p=__dirname;
let html=fs.readFileSync(p+'/index.html','utf8');if(!html.includes('src="report-ui.js"'))html=html.replace('</body>','<script src="vendor/docx/docx-9.6.1.iife.js"></script><script src="shared/calculation-docx.js"></script><script src="report-ui.js"></script></body>');fs.writeFileSync(p+'/index.html',html);
let offline=html.replace(/<link rel="stylesheet" href="style\.css[^\"]*">/,'<style>'+fs.readFileSync(p+'/style.css','utf8')+'</style>').replace(/<script src="([^\"]+)"><\/script>/g,(_,src)=>'<script>\n'+fs.readFileSync(path.join(p,src.split('?')[0]),'utf8')+'\n</script>');
fs.writeFileSync(p+'/offline.html',offline);console.log(Buffer.byteLength(offline),'offline bytes');
