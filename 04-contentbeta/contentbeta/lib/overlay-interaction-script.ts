/** Injected into test-render-slide HTML when returnHtml is true. */
export const OVERLAY_INTERACTION_SCRIPT = `<script>
(function(){
  var CANVAS=1080, SNAP=10, selected='stack';
  function qs(key){return document.querySelector('[data-drag-key="'+key+'"]');}
  function rect(el){if(!el)return null;var r=el.getBoundingClientRect();return{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};}
  function outline(){
    document.querySelectorAll('[data-drag-key]').forEach(function(el){
      el.style.outline = el.getAttribute('data-drag-key')===selected
        ? '2px solid rgba(99,102,241,0.95)'
        : '1px dashed rgba(255,255,255,0.22)';
    });
  }
  function select(key){
    selected=key;
    outline();
    window.parent.postMessage({type:'select',key:key},'*');
  }
  function extract(el){
    if(!el||el.parentElement===document.body)return;
    var r=el.getBoundingClientRect();
    var w=el.offsetWidth;
    document.body.appendChild(el);
    el.style.position='absolute';
    el.style.margin='0';
    el.style.width=w+'px';
    el.style.bottom='auto';
    el.style.right='auto';
    el.style.transform='none';
    el.style.left=Math.round(r.left)+'px';
    el.style.top=Math.round(r.top)+'px';
    el.style.zIndex='50';
  }
  function guide(show,x){
    var g=document.getElementById('__guide');
    if(!show){if(g)g.style.display='none';return;}
    if(!g){
      g=document.createElement('div');g.id='__guide';
      g.style.cssText='position:absolute;top:0;width:1px;height:1080px;background:rgba(99,102,241,0.8);z-index:200;pointer-events:none;';
      document.body.appendChild(g);
    }
    g.style.left=Math.round(x)+'px';g.style.display='block';
  }
  function snapX(nx,w){
    var center=nx+w/2;
    if(Math.abs(center-540)<SNAP) return Math.round(540-w/2);
    if(Math.abs(nx-60)<SNAP) return 60;
    if(Math.abs(nx+w-1020)<SNAP) return 1020-w;
    return nx;
  }
  function place(el,x,y){
    el.style.position='absolute';
    el.style.left=Math.round(x)+'px';
    el.style.top=Math.round(y)+'px';
    el.style.bottom='auto';
    el.style.right='auto';
    el.style.transform='none';
    el.style.margin='0';
  }
  function pinStack(el,w){
    el.style.position='absolute';
    el.style.height='auto';
    el.style.display='block';
    el.style.width=w+'px';
    el.style.zIndex='50';
  }
  function drag(el,key){
    if(!el)return;
    el.style.cursor='grab';
    el.addEventListener('mousedown',function(e){
      if(e.button!==0)return;
      e.preventDefault();
      e.stopPropagation();
      var useStack=e.shiftKey && key!=='stack';
      var targetKey=useStack?'stack':key;
      var target=useStack?(qs('stack')||el):el;
      select(targetKey);
      var r=target.getBoundingClientRect();
      var sx=e.clientX,sy=e.clientY,dragging=false,ox=r.left,oy=r.top,ew=target.offsetWidth;
      function mm(ev){
        var dx=ev.clientX-sx,dy=ev.clientY-sy;
        if(!dragging&&Math.sqrt(dx*dx+dy*dy)>4){
          dragging=true;
          if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
          if(targetKey!=='stack') extract(target);
          else pinStack(target,ew);
          target.style.cursor='grabbing';
          place(target,ox,oy);
        }
        if(dragging){
          var nx=Math.max(0,Math.min(CANVAS-24,ox+ev.clientX-sx));
          var ny=Math.max(0,Math.min(CANVAS-24,oy+ev.clientY-sy));
          var snapped=snapX(nx,ew);
          if(snapped!==nx) guide(true, snapped===Math.round(540-ew/2)?540:snapped<100?60:1020);
          else guide(false);
          place(target,snapped,ny);
        }
      }
      function mu(){
        target.style.cursor='grab';
        guide(false);
        document.removeEventListener('mousemove',mm);
        document.removeEventListener('mouseup',mu);
        if(dragging) window.parent.postMessage({type:'move',key:targetKey,x:Math.round(parseFloat(target.style.left)),y:Math.round(parseFloat(target.style.top))},'*');
      }
      document.addEventListener('mousemove',mm);
      document.addEventListener('mouseup',mu);
    });
  }
  function editable(el,key){
    if(!el)return;
    el.contentEditable='true';
    el.addEventListener('blur',function(){window.parent.postMessage({type:'text',key:key,value:el.textContent||''},'*');});
  }
  window.addEventListener('message',function(e){
    var d=e.data; if(!d||!d.type)return;
    if(d.type==='setText'){var el=document.querySelector(d.sel);if(el)el.textContent=d.value;return;}
    if(d.type==='select'){select(d.key);return;}
    if(d.type==='moveTo'||d.type==='nudge'){
      var el=qs(d.key); if(!el)return;
      if(d.key!=='stack') extract(el); else pinStack(el,el.offsetWidth);
      var r=el.getBoundingClientRect();
      var x=d.type==='nudge'?r.left+(d.dx||0):d.x;
      var y=d.type==='nudge'?r.top+(d.dy||0):d.y;
      x=Math.max(0,Math.min(CANVAS-24,x));
      y=Math.max(0,Math.min(CANVAS-24,y));
      el.style.width=el.offsetWidth+'px';
      place(el,x,y);
      select(d.key);
      window.parent.postMessage({type:'move',key:d.key,x:Math.round(x),y:Math.round(y)},'*');
    }
  });
  function boot(){
    document.querySelectorAll('[data-drag-key]').forEach(function(el){ drag(el, el.getAttribute('data-drag-key')); });
    var hl=document.querySelector('.headline');
    var mc=document.querySelector('.microcopy');
    var cta=document.querySelector('[data-type="cta"]');
    var logo=document.querySelector('[data-type="logo"]');
    if(hl&&!hl.getAttribute('data-drag-key')){hl.setAttribute('data-drag-key','headline');drag(hl,'headline');}
    if(mc&&!mc.getAttribute('data-drag-key')){mc.setAttribute('data-drag-key','microcopy');drag(mc,'microcopy');}
    if(cta&&!cta.getAttribute('data-drag-key')){cta.setAttribute('data-drag-key','cta');drag(cta,'cta');}
    if(logo&&!logo.getAttribute('data-drag-key')){logo.setAttribute('data-drag-key','logo');drag(logo,'logo');}
    editable(hl,'headline');
    editable(mc,'microcopy');
    if(cta)editable(cta,'ctaText');
    select(qs('stack')?'stack':(qs('headline')?'headline':'stack'));
    setTimeout(function(){
      function pos(el){if(!el)return null;var r=el.getBoundingClientRect();return{x:Math.round(r.left),y:Math.round(r.top)};}
      function size(el){if(!el)return null;var r=el.getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height)};}
      function getLines(el){
        if(!el||!el.textContent||!el.textContent.trim())return null;
        var style=window.getComputedStyle(el);
        var canvas=document.createElement('canvas');
        var ctx=canvas.getContext('2d');
        ctx.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
        var maxW=el.offsetWidth||el.getBoundingClientRect().width;
        var words=el.textContent.trim().split(/\\s+/);
        var lines=[],cur='';
        for(var i=0;i<words.length;i++){
          var test=cur?cur+' '+words[i]:words[i];
          if(ctx.measureText(test).width<=maxW||!cur){cur=test;}
          else{lines.push(cur);cur=words[i];}
        }
        if(cur)lines.push(cur);
        return lines.length?lines:null;
      }
      var positions={
        stack:rect(qs('stack')),
        eyebrow:rect(qs('eyebrow')),
        headline:rect(qs('headline'))||pos(hl),
        microcopy:rect(qs('microcopy'))||pos(mc),
        bullets:rect(qs('bullets')),
        cta:rect(qs('cta'))||pos(cta),
        logo:rect(qs('logo'))||pos(logo)
      };
      window.parent.postMessage({type:'ready',positions:positions,lines:{headline:getLines(hl),microcopy:getLines(mc)},ctaSize:size(cta||qs('cta'))},'*');
    },400);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
</script>`
