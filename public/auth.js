const msg=document.querySelector('#auth-msg');
const tabs=document.querySelectorAll('.tabs button');
function showTab(name){document.querySelectorAll('.auth-form').forEach(x=>x.classList.add('hidden'));document.querySelector('#'+name).classList.remove('hidden');tabs.forEach(x=>x.classList.toggle('active',x.dataset.tab===name));msg.textContent='';}
function showForgot(){document.querySelectorAll('.auth-form').forEach(x=>x.classList.add('hidden'));document.querySelector('#forgot').classList.remove('hidden');tabs.forEach(x=>x.classList.remove('active'));msg.textContent='';}
tabs.forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
async function submitForm(form,url){const body=Object.fromEntries(new FormData(form));const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Something went wrong');return d;}
document.querySelector('#signin').onsubmit=async e=>{e.preventDefault();try{const d=await submitForm(e.target,'/api/auth/signin');location.href=d.user.role==='admin'?'/admin':'/employee';}catch(err){msg.textContent=err.message;}};
document.querySelector('#signup').onsubmit=async e=>{e.preventDefault();try{await submitForm(e.target,'/api/auth/signup');location.href='/employee';}catch(err){msg.textContent=err.message;}};
document.querySelector('#forgot').onsubmit=async e=>{e.preventDefault();try{const d=await submitForm(e.target,'/api/auth/forgot-password');msg.textContent=d.message;}catch(err){msg.textContent=err.message;}};
fetch('/api/auth/me').then(r=>r.json()).then(d=>{if(d.user)location.href=d.user.role==='admin'?'/admin':'/employee';});
