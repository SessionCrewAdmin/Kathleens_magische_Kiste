(()=>{'use strict';
const Native=window.MutationObserver;if(!Native)return;
window.MutationObserver=class GuardedMutationObserver extends Native{
  constructor(callback){
    let guardedTarget=null;
    super((records,observer)=>{
      if(guardedTarget&&(guardedTarget.id==='homeSchedule'||guardedTarget.id==='todoList')){
        const selector=guardedTarget.id==='homeSchedule'?'.home-lesson-wrap':'.todo-row';
        const meaningful=records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.matches?.(selector)||node.querySelector?.(selector))));
        if(!meaningful)return;
      }
      callback(records,observer);
    });
    this.__setGuardTarget=target=>{guardedTarget=target};
  }
  observe(target,options){this.__setGuardTarget(target);return super.observe(target,options)}
};
})();