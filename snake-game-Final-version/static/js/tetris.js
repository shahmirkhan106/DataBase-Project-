(function () {
    const canvas = document.getElementById("tetrisCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const COLS = 10, ROWS = 20, BLOCK = 30;
    canvas.width  = COLS * BLOCK;
    canvas.height = ROWS * BLOCK;

    const scoreEl    = document.getElementById("t-score");
    const levelEl    = document.getElementById("t-level");
    const linesEl    = document.getElementById("t-lines");
    const statusEl   = document.getElementById("t-status");
    const nextCanvas = document.getElementById("nextCanvas");
    const nextCtx    = nextCanvas ? nextCanvas.getContext("2d") : null;
    const newGameBtn = document.getElementById("t-new-game-btn");
    const endGameBtn = document.getElementById("t-end-game-btn");
    const puListEl   = document.getElementById("t-powerups-list");

    const PIECES = {
        I:{ shape:[[1,1,1,1]], color:"#06b6d4" },
        O:{ shape:[[1,1],[1,1]], color:"#eab308" },
        T:{ shape:[[0,1,0],[1,1,1]], color:"#a855f7" },
        S:{ shape:[[0,1,1],[1,1,0]], color:"#22c55e" },
        Z:{ shape:[[1,1,0],[0,1,1]], color:"#ef4444" },
        J:{ shape:[[1,0,0],[1,1,1]], color:"#3b82f6" },
        L:{ shape:[[0,0,1],[1,1,1]], color:"#f97316" },
    };
    const KEYS = Object.keys(PIECES);

    let board, current, next, score, level, lines, gameId, rafId, isRunning;
    let lastDrop = 0, startedAt, audioEnabled = false;
    let slowFallUntil = 0, multiplierUntil = 0;
    let powerups = [];

    const randPiece = () => {
        const k = KEYS[Math.floor(Math.random() * KEYS.length)];
        const d = PIECES[k];
        return { shape: d.shape.map(r=>[...r]), color: d.color, x: Math.floor(COLS/2) - Math.ceil(d.shape[0].length/2), y: 0 };
    };

    const emptyBoard = () => Array.from({length:ROWS}, ()=>Array(COLS).fill(null));

    function rotate(s){ const R=s.length,C=s[0].length,n=Array.from({length:C},()=>Array(R).fill(0));for(let r=0;r<R;r++)for(let c=0;c<C;c++)n[c][R-1-r]=s[r][c];return n; }

    function valid(shape,ox,oy,bd=board){
        for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++){
            if(!shape[r][c])continue;
            const nx=ox+c,ny=oy+r;
            if(nx<0||nx>=COLS||ny>=ROWS)return false;
            if(ny>=0&&bd[ny][nx])return false;
        }
        return true;
    }

    function lock(){
        for(let r=0;r<current.shape.length;r++)for(let c=0;c<current.shape[r].length;c++){
            if(!current.shape[r][c])continue;
            const y=current.y+r;
            if(y<0){endGame();return;}
            board[y][current.x+c]=current.color;
        }
        clearLines(); current=next; next=randPiece(); drawNext();
        if(!valid(current.shape,current.x,current.y)){endGame();}
    }

    function clearLines(){
        let cleared=0;
        for(let r=ROWS-1;r>=0;r--){
            if(board[r].every(c=>c!==null)){board.splice(r,1);board.unshift(Array(COLS).fill(null));cleared++;r++;}
        }
        if(!cleared)return;
        lines+=cleared;
        const pts=[0,100,300,500,800][cleared]||800;
        score+= pts*level*(Date.now()<multiplierUntil?2:1);
        level=Math.floor(lines/10)+1;
        updateUI(); playTone(600,80,0.05);
    }

    function ghostY(){let g=current.y;while(valid(current.shape,current.x,g+1))g++;return g;}

    function drawBlock(x,y,col,a=1){
        ctx.globalAlpha=a;ctx.fillStyle=col;
        ctx.fillRect(x*BLOCK+1,y*BLOCK+1,BLOCK-2,BLOCK-2);
        ctx.fillStyle="rgba(255,255,255,0.18)";ctx.fillRect(x*BLOCK+1,y*BLOCK+1,BLOCK-2,5);
        ctx.globalAlpha=1;
    }

    function render(){
        ctx.fillStyle="#f8fafc";ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle="#e2e8f0";ctx.lineWidth=1;
        for(let r=0;r<=ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*BLOCK);ctx.lineTo(canvas.width,r*BLOCK);ctx.stroke();}
        for(let c=0;c<=COLS;c++){ctx.beginPath();ctx.moveTo(c*BLOCK,0);ctx.lineTo(c*BLOCK,canvas.height);ctx.stroke();}
        for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c])drawBlock(c,r,board[r][c]);
        if(current){
            const gy=ghostY();
            for(let r=0;r<current.shape.length;r++)for(let c=0;c<current.shape[r].length;c++)if(current.shape[r][c])drawBlock(current.x+c,gy+r,current.color,0.22);
            for(let r=0;r<current.shape.length;r++)for(let c=0;c<current.shape[r].length;c++)if(current.shape[r][c])drawBlock(current.x+c,current.y+r,current.color);
        }
        updateUI();
    }

    function drawNext(){
        if(!nextCtx||!next)return;
        nextCtx.fillStyle="#f8fafc";nextCtx.fillRect(0,0,nextCanvas.width,nextCanvas.height);
        const ox=Math.floor((4-next.shape[0].length)/2),oy=Math.floor((4-next.shape.length)/2);
        for(let r=0;r<next.shape.length;r++)for(let c=0;c<next.shape[r].length;c++)if(next.shape[r][c]){
            nextCtx.fillStyle=next.color;nextCtx.fillRect((ox+c)*24+1,(oy+r)*24+1,22,22);
        }
    }

    function updateUI(){
        if(scoreEl)scoreEl.textContent=score;
        if(levelEl)levelEl.textContent=level;
        if(linesEl)linesEl.textContent=lines;
    }

    function gameLoop(ts){
        if(!isRunning)return;
        if(!lastDrop)lastDrop=ts;
        const spd=Date.now()<slowFallUntil?1400:Math.max(100,800-(level-1)*70);
        if(ts-lastDrop>=spd){
            if(!valid(current.shape,current.x,current.y+1))lock();
            else current.y++;
            lastDrop=ts;
        }
        render();
        rafId=requestAnimationFrame(gameLoop);
    }

    function startLoop(){
        if(rafId)cancelAnimationFrame(rafId);
        isRunning=true;lastDrop=0;
        document.body.classList.add("play-locked");
        rafId=requestAnimationFrame(gameLoop);
        if(statusEl)statusEl.textContent="Playing";
    }

    function stopLoop(){
        if(rafId)cancelAnimationFrame(rafId);rafId=null;isRunning=false;
        document.body.classList.remove("play-locked");
    }

    function endGame(){
        stopLoop();if(statusEl)statusEl.textContent="Game Over";
        playTone(160,400,0.1);
        setTimeout(()=>alert(`Game Over!\nScore: ${score}  Lines: ${lines}  Level: ${level}`),50);
    }

    document.addEventListener("keydown",(e)=>{
        ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].forEach(k=>{if(e.key===k)e.preventDefault();});
        if(!isRunning||!current)return;
        audioEnabled=true;
        if(e.key==="ArrowLeft"&&valid(current.shape,current.x-1,current.y))current.x--;
        if(e.key==="ArrowRight"&&valid(current.shape,current.x+1,current.y))current.x++;
        if(e.key==="ArrowDown"){if(valid(current.shape,current.x,current.y+1)){current.y++;score++;}else lock();lastDrop=performance.now();}
        if(e.key==="ArrowUp"){const rot=rotate(current.shape);if(valid(rot,current.x,current.y))current.shape=rot;}
        if(e.key===" "){while(valid(current.shape,current.x,current.y+1)){current.y++;score+=2;}lock();}
        if(["1","2","3","4"].includes(e.key))usePowerup(parseInt(e.key)-1);
    });

    function playTone(freq,dur,vol){
        if(!audioEnabled)return;
        try{const ac=new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();
        o.type="triangle";o.frequency.value=freq;g.gain.value=vol;o.connect(g);g.connect(ac.destination);o.start();
        setTimeout(()=>{o.stop();ac.close();},dur);}catch(_){audioEnabled=false;}
    }

    async function postJson(url,data){
        const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
        return r.json();
    }

    async function newGame(){
        const res=await postJson("/game/new",{game_type:"tetris"});
        if(!res.success){alert(res.message||"Could not start.");return;}
        gameId=res.game_id;board=emptyBoard();score=0;level=1;lines=0;startedAt=Date.now();
        slowFallUntil=0;multiplierUntil=0;current=randPiece();next=randPiece();drawNext();startLoop();
    }

    async function submitScore(){
        stopLoop();if(!gameId){alert("No active game.");return;}
        const dur=Math.max(1,Math.floor((Date.now()-startedAt)/1000));
        const res=await postJson("/game/submit-score",{game_id:gameId,score,moves:lines,duration_seconds:dur,game_type:"tetris"});
        if(!res.success){alert(res.message||"Submit failed.");return;}
        alert("Score submitted!");window.location.href="/game/leaderboard?g=tetris";
    }

    async function loadPowerups(){
        if(!puListEl)return;
        try{
            const res=await(await fetch("/shop/powerups?game=tetris")).json();
            if(!res.success||!res.powerups.length){puListEl.innerHTML='<p style="font-size:0.82rem;color:var(--text-muted);">No power-ups. <a href="/shop/?game=tetris">Buy some!</a></p>';return;}
            powerups=res.powerups;renderPUList();
        }catch(_){}
    }

    function renderPUList(){
        if(!puListEl)return;puListEl.innerHTML="";
        const icons={"Ghost Piece Boost":"fa-eye","Slow Fall":"fa-feather","Row Bomb":"fa-bomb","Score Multiplier":"fa-star"};
        powerups.slice(0,4).forEach((pu,i)=>{
            const icon=icons[pu.name]||"fa-bolt";
            const div=document.createElement("div");div.className="powerup-item";
            div.innerHTML=`<span class="powerup-hotkey">${i+1}</span><i class="fa-solid ${icon}" style="color:var(--accent-amber);width:16px;text-align:center;"></i><span style="font-size:0.82rem;font-weight:500;flex:1;">${pu.name}</span><span class="powerup-qty" id="tpu-qty-${pu.id}">×${pu.quantity}</span>`;
            puListEl.appendChild(div);
        });
    }

    async function usePowerup(idx){
        if(idx>=powerups.length)return;const pu=powerups[idx];if(pu.quantity<=0)return;
        const n=pu.name.toLowerCase();
        if(n.includes("slow")){slowFallUntil=Date.now()+30000;}
        else if(n.includes("bomb")){board.splice(ROWS-2,2);board.unshift(Array(COLS).fill(null));board.unshift(Array(COLS).fill(null));score+=50;}
        else if(n.includes("multi")){multiplierUntil=Date.now()+60000;}
        pu.quantity--;const el=document.getElementById(`tpu-qty-${pu.id}`);if(el)el.textContent=`×${pu.quantity}`;
        playTone(600,100,0.08);
        try{await postJson("/shop/consume",{item_id:pu.id});}catch(_){}
    }

    if(newGameBtn)newGameBtn.addEventListener("click",newGame);
    if(endGameBtn)endGameBtn.addEventListener("click",submitScore);
    loadPowerups();board=emptyBoard();score=0;level=1;lines=0;current=randPiece();next=randPiece();drawNext();render();
    if(statusEl)statusEl.textContent="Ready – Click New Game";
})();
