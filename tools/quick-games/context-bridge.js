(()=>{'use strict';
const text=value=>String(value??'').trim();
const context=()=>window.KathleenTeachingContext;
function grade(value){const match=text(value).match(/\d{1,2}/);return match?Number(match[0]):undefined}
function display(){const target=document.getElementById('teachingContextPill');if(!target)return;const value=context()?.get?.()||{};const label=context()?.label?.(value)||'';target.hidden=!label;if(label)target.textContent=label}
function hydrate(){const value=context()?.get?.()||{};const subject=document.getElementById('setSubject'),level=document.getElementById('setGrade');if(subject&&!text(subject.value)&&value.subject)subject.value=value.subject;if(level&&!text(level.value)&&value.grade)level.value=String(value.grade);display()}
function persist(){const subject=text(document.getElementById('setSubject')?.value),level=grade(document.getElementById('setGrade')?.value);if(subject||level)context()?.set?.({subject,grade:level,source:'quick-games'});display()}
function init(){const hero=document.querySelector('.qg-context');if(hero&&!document.getElementById('teachingContextPill')){const pill=document.createElement('span');pill.className='qg-pill';pill.id='teachingContextPill';pill.hidden=true;hero.prepend(pill)}hydrate();document.addEventListener('click',event=>{if(event.target.closest('#saveBtn'))setTimeout(persist,0)},true);window.addEventListener('kathleen:teachingcontext',display);new MutationObserver(hydrate).observe(document.getElementById('workspace')||document.body,{attributes:true,subtree:true,attributeFilter:['class']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
