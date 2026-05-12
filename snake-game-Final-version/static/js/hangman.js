(function(){
    const WORDS = [
        {w:"javascript",c:"Programming"},{w:"python",c:"Programming"},{w:"keyboard",c:"Technology"},
        {w:"database",c:"Technology"},{w:"algorithm",c:"Programming"},{w:"interface",c:"Technology"},
        {w:"elephant",c:"Animals"},{w:"penguin",c:"Animals"},{w:"dolphin",c:"Animals"},
        {w:"cheetah",c:"Animals"},{w:"gorilla",c:"Animals"},{w:"kangaroo",c:"Animals"},
        {w:"mountain",c:"Nature"},{w:"volcano",c:"Nature"},{w:"glacier",c:"Nature"},
        {w:"tropical",c:"Nature"},{w:"thunder",c:"Nature"},{w:"rainbow",c:"Nature"},
        {w:"football",c:"Sports"},{w:"baseball",c:"Sports"},{w:"swimming",c:"Sports"},
        {w:"marathon",c:"Sports"},{w:"cycling",c:"Sports"},{w:"archery",c:"Sports"},
        {w:"chocolate",c:"Food"},{w:"strawberry",c:"Food"},{w:"cucumber",c:"Food"},
        {w:"pineapple",c:"Food"},{w:"avocado",c:"Food"},{w:"broccoli",c:"Food"},
        {w:"adventure",c:"General"},{w:"champion",c:"General"},{w:"discover",c:"General"},
        {w:"fantastic",c:"General"},{w:"generous",c:"General"},{w:"horizon",c:"General"},
        {w:"invisible",c:"General"},{w:"jealousy",c:"General"},{w:"knowledge",c:"General"},
        {w:"labyrinth",c:"General"},{w:"magnetic",c:"General"},{w:"navigate",c:"General"},
        {w:"orchestra",c:"General"},{w:"paradise",c:"General"},{w:"question",c:"General"},
        {w:"treasure",c:"General"},{w:"umbrella",c:"General"},{w:"vacation",c:"General"},
        {w:"whisper",c:"General"},{w:"xylophone",c:"General"},{w:"yesterday",c:"General"},
    ];

    const MAX_WRONG = 6;

    const svgEl     = document.getElementById("hangman-svg");
    const wordEl    = document.getElementById("word-display");
    const catEl     = document.getElementById("word-category");
    const wrongEl   = document.getElementById("wrong-letters");
    const livesEl   = document.getElementById("lives-left");
    const scoreEl   = document.getElementById("h-score");
    const statusEl  = document.getElementById("h-status");
    const keysEl    = document.getElementById("keyboard-area");
    const newBtn    = document.getElementById("h-new-game-btn");
    const endBtn    = document.getElementById("h-end-game-btn");
    const puListEl  = document.getElementById("h-powerups-list");

    let word, category, guessed, wrong, score, gameId, isActive, startedAt;
    let doublePoints = false, extraLife = false, powerups = [];
    let totalMoves = 0;

    // ── SVG Hangman stages ───────────────────────────
    const SVG_PARTS = [
        '<line x1="40" y1="180" x2="160" y2="180" stroke="#475569" stroke-width="4"/>',   // base
        '<line x1="100" y1="180" x2="100" y2="20" stroke="#475569" stroke-width="4"/>',   // pole
        '<line x1="100" y1="20" x2="150" y2="20" stroke="#475569" stroke-width="4"/>',    // beam
        '<line x1="150" y1="20" x2="150" y2="50" stroke="#475569" stroke-width="4"/>',    // rope
        '<circle cx="150" cy="65" r="15" stroke="#ef4444" stroke-width="3" fill="#fee2e2"/>', // head
        '<line x1="150" y1="80" x2="150" y2="130" stroke="#ef4444" stroke-width="3"/>',   // body
        '<line x1="150" y1="90" x2="130" y2="110" stroke="#ef4444" stroke-width="3"/><line x1="150" y1="90" x2="170" y2="110" stroke="#ef4444" stroke-width="3"/>', // arms
        '<line x1="150" y1="130" x2="130" y2="160" stroke="#ef4444" stroke-width="3"/><line x1="150" y1="130" x2="170" y2="160" stroke="#ef4444" stroke-width="3"/>', // legs
    ];

    function updateSVG(){
        if(!svgEl)return;
        const show = Math.min(wrong + 3, SVG_PARTS.length); // always show gallows (0-2), then body parts
        svgEl.innerHTML = SVG_PARTS.slice(0, 3).join("") + SVG_PARTS.slice(3, 3 + wrong).join("");
    }

    function pickWord(){
        const entry = WORDS[Math.floor(Math.random()*WORDS.length)];
        word = entry.w; category = entry.c;
    }

    function renderWord(){
        if(!wordEl)return;
        wordEl.innerHTML = word.split("").map(l=>
            `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:44px;border-bottom:3px solid var(--border-light);margin:0 3px;font-size:1.5rem;font-weight:700;color:${guessed.has(l)?'var(--accent-green)':'transparent'};">${guessed.has(l)?l:''}</span>`
        ).join("");
    }

    function renderKeyboard(){
        if(!keysEl)return;
        keysEl.innerHTML="";
        "abcdefghijklmnopqrstuvwxyz".split("").forEach(l=>{
            const btn=document.createElement("button");
            btn.textContent=l.toUpperCase();
            btn.className="btn btn-sm";
            btn.style.cssText=`width:38px;height:38px;padding:0;font-weight:700;font-size:0.8rem;`;
            if(guessed.has(l)){
                const hit=word.includes(l);
                btn.style.background=hit?"var(--accent-green)":"#ef4444";
                btn.style.color="#fff";btn.style.borderColor="transparent";
                btn.disabled=true;
            }
            btn.addEventListener("click",()=>guess(l));
            keysEl.appendChild(btn);
        });
    }

    function guess(letter){
        if(!isActive||guessed.has(letter))return;
        guessed.add(letter);totalMoves++;
        if(!word.includes(letter)){
            wrong++;
            if(livesEl)livesEl.textContent=Math.max(0,(extraLife?MAX_WRONG+1:MAX_WRONG)-wrong);
        }
        updateSVG();renderWord();renderKeyboard();
        if(wrongEl)wrongEl.textContent=[...guessed].filter(l=>!word.includes(l)).join("  ").toUpperCase();
        checkEnd();
    }

    function checkEnd(){
        const maxWrong = extraLife ? MAX_WRONG+1 : MAX_WRONG;
        const won = word.split("").every(l=>guessed.has(l));
        const lost = wrong >= maxWrong;
        if(!won&&!lost)return;
        isActive=false;
        if(won){
            const remaining = maxWrong-wrong;
            const pts = (word.length*10 + remaining*15) * (doublePoints?2:1);
            score+=pts;
            if(scoreEl)scoreEl.textContent=score;
            setTimeout(()=>{ if(confirm(`🎉 You got it! "${word.toUpperCase()}" +${pts} pts\n\nPlay next word?`))startRound(); },50);
        } else {
            setTimeout(()=>alert(`❌ Game over! The word was "${word.toUpperCase()}"`),50);
        }
    }

    function startRound(){
        pickWord();
        guessed=new Set();wrong=0;isActive=true;
        extraLife=false;doublePoints=false;
        if(catEl)catEl.textContent=`Category: ${category}`;
        if(livesEl)livesEl.textContent=MAX_WRONG;
        if(wrongEl)wrongEl.textContent="";
        updateSVG();renderWord();renderKeyboard();
        if(statusEl)statusEl.textContent="Playing";
    }

    async function postJson(url,data){
        const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
        return r.json();
    }

    async function newGame(){
        const res=await postJson("/game/new",{game_type:"hangman"});
        if(!res.success){alert(res.message||"Could not start.");return;}
        gameId=res.game_id;score=0;totalMoves=0;startedAt=Date.now();
        if(scoreEl)scoreEl.textContent=0;
        startRound();
    }

    async function submitScore(){
        isActive=false;
        if(!gameId){alert("No active game.");return;}
        const dur=Math.max(1,Math.floor((Date.now()-startedAt)/1000));
        const res=await postJson("/game/submit-score",{game_id:gameId,score,moves:Math.max(totalMoves,1),duration_seconds:dur,game_type:"hangman"});
        if(!res.success){alert(res.message||"Submit failed.");return;}
        alert(`Score submitted! Final: ${score} pts`);
        window.location.href="/game/leaderboard?g=hangman";
    }

    // ── Power-ups ─────────────────────────────────────
    async function loadPowerups(){
        if(!puListEl)return;
        try{
            const res=await(await fetch("/shop/powerups?game=hangman")).json();
            if(!res.success||!res.powerups.length){puListEl.innerHTML='<p style="font-size:0.82rem;color:var(--text-muted);">No power-ups. <a href="/shop/?game=hangman">Buy some!</a></p>';return;}
            powerups=res.powerups;renderPUList();
        }catch(_){}
    }

    function renderPUList(){
        if(!puListEl)return;puListEl.innerHTML="";
        const icons={"Extra Life":"fa-heart","Hint Letter":"fa-lightbulb","Skip Word":"fa-forward","Double Points":"fa-star"};
        powerups.slice(0,4).forEach((pu,i)=>{
            const icon=icons[pu.name]||"fa-bolt";
            const div=document.createElement("div");div.className="powerup-item";
            div.innerHTML=`<span class="powerup-hotkey">${i+1}</span><i class="fa-solid ${icon}" style="color:var(--accent-amber);width:16px;text-align:center;"></i><span style="font-size:0.82rem;font-weight:500;flex:1;">${pu.name}</span><span class="powerup-qty" id="hpu-qty-${pu.id}">×${pu.quantity}</span>`;
            puListEl.appendChild(div);
        });
    }

    async function usePowerup(idx){
        if(idx>=powerups.length)return;const pu=powerups[idx];if(pu.quantity<=0)return;
        const n=pu.name.toLowerCase();
        if(n.includes("extra")){extraLife=true;if(livesEl)livesEl.textContent=MAX_WRONG+1-wrong;}
        else if(n.includes("hint")){
            const unrevealed=word.split("").filter(l=>!guessed.has(l));
            if(unrevealed.length)guess(unrevealed[Math.floor(Math.random()*unrevealed.length)]);
        }
        else if(n.includes("skip")){startRound();return;}
        else if(n.includes("double")){doublePoints=true;}
        pu.quantity--;const el=document.getElementById(`hpu-qty-${pu.id}`);if(el)el.textContent=`×${pu.quantity}`;
        try{await postJson("/shop/consume",{item_id:pu.id});}catch(_){}
    }

    document.addEventListener("keydown",(e)=>{
        if(e.key.length===1&&/[a-z]/i.test(e.key))guess(e.key.toLowerCase());
        if(["1","2","3","4"].includes(e.key))usePowerup(parseInt(e.key)-1);
    });

    if(newBtn)newBtn.addEventListener("click",newGame);
    if(endBtn)endBtn.addEventListener("click",submitScore);
    loadPowerups();updateSVG();
    if(statusEl)statusEl.textContent="Ready – Click New Game";
})();
