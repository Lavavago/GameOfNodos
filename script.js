document.addEventListener('DOMContentLoaded', () => {
    const screens = {
        intro: document.getElementById('screen-intro'),
        ingresaNombre: document.getElementById('screen-ingresa-nombre'),
        inicio: document.getElementById('screen-inicio'),
        instrucciones: document.getElementById('screen-instrucciones'),
        elegirPersonaje: document.getElementById('screen-elegirPersonaje'),
        espera: document.getElementById('screen-espera'),
        nodoInicial: document.getElementById('screen-nodo-inicial'),
        video: document.getElementById('screen-video'),
        puestos: document.getElementById('screen-puestos'),
        mapaNodos: document.getElementById('screen-mapa-nodos'),
        preguntaId: document.getElementById('screen-pregunta-id'),
        preguntaTr: document.getElementById('screen-pregunta-tr')
    };

    const overlay = document.getElementById('transition-overlay');
    const introVideo = document.getElementById('intro-video');
    const btnSkipIntro = document.getElementById('btn-skip-intro');
    const bgMusic = document.getElementById('bg-music');
    const introOverlay = document.getElementById('intro-overlay');
    const btnStartGame = document.getElementById('btn-start-game');
    const teamNameInput = document.getElementById('nombreEquipo');
    const btnTeamContinue = document.getElementById('btn-team-continue');
    const supabaseClient = window.supabase?.createClient
        ? window.supabase.createClient(
            'https://tzhryzeubsxvuehdoqio.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6aHJ5emV1YnN4dnVlaGRvcWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjgzNDcsImV4cCI6MjA5MTM0NDM0N30.XbGEFZixKKiGQW6QYhHJquqMX525b8XmgIfb6k_lp2w'
        )
        : null;

    const rankingList = document.getElementById('ranking-list');
    let rankingPollTimer = null;
    let lastRankingSignature = '';
    let finishUpdateInFlight = false;
    let finishedAtMarked = false;

    function getMatchId() {
        const urlMatch = new URLSearchParams(window.location.search).get('match');
        const saved = localStorage.getItem('matchId');
        const value = (urlMatch || saved || 'global').trim() || 'global';
        localStorage.setItem('matchId', value);
        return value;
    }

    function getSessionId() {
        return (localStorage.getItem('sessionId') || '').trim();
    }

    async function markFinishedOnce() {
        if (finishedAtMarked) return;
        const sessionId = getSessionId();
        if (!sessionId) {
            showToast('No se encontró sessionId.', 'error');
            return;
        }
        const cacheKey = `finishedAt:${sessionId}`;
        if (localStorage.getItem(cacheKey)) {
            finishedAtMarked = true;
            return;
        }
        if (!supabaseClient) {
            showToast('Supabase no está listo.', 'error');
            return;
        }
        if (finishUpdateInFlight) return;
        finishUpdateInFlight = true;
        try {
            const iso = new Date().toISOString();
            const { error } = await supabaseClient
                .from('sessions')
                .update({ finished_at: iso })
                .eq('id', sessionId);
            if (error) {
                showToast('No se pudo guardar la llegada.', 'error');
                return;
            }
            localStorage.setItem(cacheKey, iso);
            finishedAtMarked = true;
        } finally {
            finishUpdateInFlight = false;
        }
    }

    function formatDuration(ms) {
        const total = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    async function fetchRanking() {
        if (!supabaseClient) return null;
        const matchId = getMatchId();
        const { data, error } = await supabaseClient
            .from('sessions')
            .select('id,name,created_at,finished_at')
            .eq('match_id', matchId)
            .order('finished_at', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true })
            .range(0, 999);
        if (error) {
            if (rankingList) rankingList.textContent = 'Error cargando ranking.';
            showToast('Error cargando ranking.', 'error');
            return null;
        }
        return data || [];
    }

    function renderRanking(rows) {
        if (!rankingList) return;
        if (!rows || !rows.length) {
            rankingList.textContent = 'Aún no hay llegadas.';
            return;
        }

        const me = getSessionId();
        rankingList.innerHTML = '';

        rows.forEach((row, idx) => {
            const created = new Date(row.created_at);
            const isFinished = Boolean(row.finished_at);
            const durationText = isFinished
                ? formatDuration(new Date(row.finished_at).getTime() - created.getTime())
                : 'EN JUEGO';

            const item = document.createElement('div');
            item.className = `ranking-row${idx === 0 ? ' top1' : ''}${isFinished ? '' : ' pending'}`;
            if (me && row.id === me) item.style.borderColor = 'rgba(72, 255, 166, 0.9)';

            const pos = document.createElement('div');
            pos.className = 'rank-pos';
            pos.textContent = String(idx + 1);

            const name = document.createElement('div');
            name.className = 'rank-name';
            name.textContent = row.name || 'Equipo';

            const time = document.createElement('div');
            time.className = `rank-time${isFinished ? '' : ' pending'}`;
            time.textContent = durationText;

            item.appendChild(pos);
            item.appendChild(name);
            item.appendChild(time);
            rankingList.appendChild(item);
        });
    }

    async function startRankingPolling() {
        if (rankingPollTimer) clearInterval(rankingPollTimer);
        if (rankingList) rankingList.textContent = 'CARGANDO...';
        lastRankingSignature = '';

        const tick = async () => {
            if (!screens.puestos || !screens.puestos.classList.contains('active')) return;
            const rows = await fetchRanking();
            if (!rows) return;
            const signature = rows.map(r => `${r.id}|${r.finished_at}|${r.name}`).join(';');
            if (signature === lastRankingSignature) return;
            lastRankingSignature = signature;
            renderRanking(rows);
        };

        await tick();
        rankingPollTimer = setInterval(tick, 2000);
        setTimeout(() => {
            if (rankingPollTimer) {
                clearInterval(rankingPollTimer);
                rankingPollTimer = null;
            }
        }, 120000);
    }

    // Botones de la pantalla de inicio
    const btnJugar = document.getElementById('btn-jugar');
    const btnInstrucciones = document.getElementById('btn-instrucciones');

    // Botones de volver
    const btnVolverInst = document.getElementById('btn-volver-inst');
    const btnContinuarInst = document.getElementById('btn-continuar-inst');
    const btnVolverPersonaje = document.getElementById('btn-volver-personaje');
    const btnVolverJuego = document.getElementById('btn-volver-juego');
    const btnVolverVideo = document.getElementById('btn-volver-video');
    const rpTriggerBtn = document.getElementById('rp-trigger-btn');
    const finalVideo = document.getElementById('final-video');
    const btnVolverMapa = document.getElementById('btn-volver-mapa');
    const btnNodeId = document.getElementById('btn-node-id');
    const btnNodeTr = document.getElementById('btn-node-tr');
    const btnNodeSu = document.getElementById('btn-node-su');
    const btnNodeCt = document.getElementById('btn-node-ct');
    const btnNodeIn = document.getElementById('btn-node-in');
    const btnNodeCi = document.getElementById('btn-node-ci');
    const btnNodeMk = document.getElementById('btn-node-mk');
    const btnNodeSo = document.getElementById('btn-node-so');
    const btnNodeAn = document.getElementById('btn-node-an');
    const btnNodeMp = document.getElementById('btn-node-mp');
    const btnNodeEs = document.getElementById('btn-node-es');
    const mapViewport = document.getElementById('map-viewport');
    const mapCanvas = document.getElementById('map-canvas');
    const btnVolverPreguntaId = document.getElementById('btn-volver-pregunta-id');
    const btnVolverPreguntaTr = document.getElementById('btn-volver-pregunta-tr');
    const mapCharacterDisplay = document.getElementById('map-character-display');
    const mapCharacterImg = document.getElementById('map-character-img');
    const mapStatusText = document.getElementById('map-status-text');
    const nodeRp = document.getElementById('node-rp');
    const mapQuiz = document.getElementById('map-quiz');
    const mapQuizQuestion = document.getElementById('map-quiz-question');
    const mapQuizA = document.getElementById('map-quiz-a');
    const mapQuizB = document.getElementById('map-quiz-b');
    const mapQuizC = document.getElementById('map-quiz-c');
    const mapQuizCancel = document.getElementById('map-quiz-cancel');
    const toast = document.getElementById('toast');
    const lineRpId = document.getElementById('line-rp-id');
    const lineRpTr = document.getElementById('line-rp-tr');
    const lineIdSu = document.getElementById('line-id-su');
    const lineTrCt = document.getElementById('line-tr-ct');
    const lineSuIn = document.getElementById('line-su-in');
    const lineCtIn = document.getElementById('line-ct-in');
    const lineInCi = document.getElementById('line-in-ci');
    const lineCiMk = document.getElementById('line-ci-mk');
    const lineMkSo = document.getElementById('line-mk-so');
    const lineSoAn = document.getElementById('line-so-an');
    const lineAnMp = document.getElementById('line-an-mp');
    const lineMpEs = document.getElementById('line-mp-es');
    const completeOverlay = document.getElementById('complete-overlay');
    const btnCompleteHome = document.getElementById('btn-complete-home');
    const penaltyOverlay = document.getElementById('penalty-overlay');
    const penaltySecondsEl = document.getElementById('penalty-seconds');
    let wrongStreak = 0;
    let penaltyActive = false;
    let penaltyInterval = null;

    function startPenalty(seconds) {
        if (!penaltyOverlay || !penaltySecondsEl) return;
        if (penaltyInterval) {
            clearInterval(penaltyInterval);
            penaltyInterval = null;
        }
        penaltyActive = true;
        let remaining = Math.max(1, Math.floor(seconds));
        penaltySecondsEl.textContent = String(remaining);
        penaltyOverlay.classList.add('show');
        penaltyInterval = setInterval(() => {
            remaining -= 1;
            penaltySecondsEl.textContent = String(Math.max(0, remaining));
            if (remaining <= 0) {
                clearInterval(penaltyInterval);
                penaltyInterval = null;
                penaltyOverlay.classList.remove('show');
                penaltyActive = false;
            }
        }, 1000);
    }

    function getCenterInCanvas(elem) {
        if (!mapCanvas) return null;
        const canvasRect = mapCanvas.getBoundingClientRect();
        const rect = elem.getBoundingClientRect();
        if (!canvasRect.width || !rect.width) return null;
        return {
            x: rect.left - canvasRect.left + rect.width / 2,
            y: rect.top - canvasRect.top + rect.height / 2
        };
    }

    function updateLines() {
        if (!screens.mapaNodos.classList.contains('active')) return;
        if (!mapCanvas) return;

        const rp = nodeRp ? getCenterInCanvas(nodeRp) : null;
        const id = btnNodeId ? getCenterInCanvas(btnNodeId) : null;
        const tr = btnNodeTr ? getCenterInCanvas(btnNodeTr) : null;
        const su = btnNodeSu ? getCenterInCanvas(btnNodeSu) : null;
        const ct = btnNodeCt ? getCenterInCanvas(btnNodeCt) : null;
        const inn = btnNodeIn ? getCenterInCanvas(btnNodeIn) : null;
        const ci = btnNodeCi ? getCenterInCanvas(btnNodeCi) : null;
        const mk = btnNodeMk ? getCenterInCanvas(btnNodeMk) : null;
        const so = btnNodeSo ? getCenterInCanvas(btnNodeSo) : null;
        const an = btnNodeAn ? getCenterInCanvas(btnNodeAn) : null;
        const mp = btnNodeMp ? getCenterInCanvas(btnNodeMp) : null;
        const es = btnNodeEs ? getCenterInCanvas(btnNodeEs) : null;

        if (rp && id && lineRpId) {
            lineRpId.setAttribute('x1', rp.x);
            lineRpId.setAttribute('y1', rp.y);
            lineRpId.setAttribute('x2', id.x);
            lineRpId.setAttribute('y2', id.y);
        }

        if (rp && tr && lineRpTr) {
            lineRpTr.setAttribute('x1', rp.x);
            lineRpTr.setAttribute('y1', rp.y);
            lineRpTr.setAttribute('x2', tr.x);
            lineRpTr.setAttribute('y2', tr.y);
        }

        if (id && su && lineIdSu) {
            lineIdSu.setAttribute('x1', id.x);
            lineIdSu.setAttribute('y1', id.y);
            lineIdSu.setAttribute('x2', su.x);
            lineIdSu.setAttribute('y2', su.y);
        }

        if (tr && ct && lineTrCt) {
            lineTrCt.setAttribute('x1', tr.x);
            lineTrCt.setAttribute('y1', tr.y);
            lineTrCt.setAttribute('x2', ct.x);
            lineTrCt.setAttribute('y2', ct.y);
        }

        if (su && inn && lineSuIn) {
            lineSuIn.setAttribute('x1', su.x);
            lineSuIn.setAttribute('y1', su.y);
            lineSuIn.setAttribute('x2', inn.x);
            lineSuIn.setAttribute('y2', inn.y);
        }

        if (ct && inn && lineCtIn) {
            lineCtIn.setAttribute('x1', ct.x);
            lineCtIn.setAttribute('y1', ct.y);
            lineCtIn.setAttribute('x2', inn.x);
            lineCtIn.setAttribute('y2', inn.y);
        }

        if (inn && ci && lineInCi) {
            lineInCi.setAttribute('x1', inn.x);
            lineInCi.setAttribute('y1', inn.y);
            lineInCi.setAttribute('x2', ci.x);
            lineInCi.setAttribute('y2', ci.y);
        }

        if (ci && mk && lineCiMk) {
            lineCiMk.setAttribute('x1', ci.x);
            lineCiMk.setAttribute('y1', ci.y);
            lineCiMk.setAttribute('x2', mk.x);
            lineCiMk.setAttribute('y2', mk.y);
        }

        if (mk && so && lineMkSo) {
            lineMkSo.setAttribute('x1', mk.x);
            lineMkSo.setAttribute('y1', mk.y);
            lineMkSo.setAttribute('x2', so.x);
            lineMkSo.setAttribute('y2', so.y);
        }

        if (so && an && lineSoAn) {
            lineSoAn.setAttribute('x1', so.x);
            lineSoAn.setAttribute('y1', so.y);
            lineSoAn.setAttribute('x2', an.x);
            lineSoAn.setAttribute('y2', an.y);
        }

        if (an && mp && lineAnMp) {
            lineAnMp.setAttribute('x1', an.x);
            lineAnMp.setAttribute('y1', an.y);
            lineAnMp.setAttribute('x2', mp.x);
            lineAnMp.setAttribute('y2', mp.y);
        }

        if (mp && es && lineMpEs) {
            lineMpEs.setAttribute('x1', mp.x);
            lineMpEs.setAttribute('y1', mp.y);
            lineMpEs.setAttribute('x2', es.x);
            lineMpEs.setAttribute('y2', es.y);
        }
    }

    // Función para cambiar de pantalla con transición
    function changeScreen(targetScreenId) {
        // Iniciar desvanecimiento de pantalla (transición de video juego)
        overlay.classList.add('active');

        setTimeout(() => {
            // Ocultar todas las pantallas
            Object.values(screens).forEach(screen => {
                screen.classList.remove('active');
                screen.style.display = 'none';
            });

            // Mostrar la pantalla objetivo
            const targetScreen = screens[targetScreenId];
            targetScreen.style.display = 'flex';
            
            // Forzar reflujo para que el navegador aplique la opacidad correctamente
            void targetScreen.offsetWidth;

            targetScreen.classList.add('active');

            // Quitar el overlay de transición
            setTimeout(() => {
                overlay.classList.remove('active');
            }, 300);

            if (targetScreenId === 'mapaNodos') {
                requestAnimationFrame(() => {
                    syncSelectedCharacter();
                    positionCharacterAt(mapPosition);
                    updateLines();
                    initMapViewport();
                });
            }
        }, 300);
    }

    // Configurar los eventos de clic con mayor sensibilidad para móviles
    const fastClick = (btn, action) => {
        // Usamos click pero nos aseguramos que no haya nada bloqueando
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            action();
        });
        
        // También podemos añadir pointerdown para respuesta visual inmediata
        btn.addEventListener('pointerdown', () => {
            const target = btn.classList.contains('node-btn') ? (btn.querySelector('img') || btn) : btn;
            target.style.transform = 'scale(0.95)';
        });
        
        btn.addEventListener('pointerup', () => {
            const target = btn.classList.contains('node-btn') ? (btn.querySelector('img') || btn) : btn;
            target.style.transform = 'scale(1)';
        });
        
        btn.addEventListener('pointerleave', () => {
            const target = btn.classList.contains('node-btn') ? (btn.querySelector('img') || btn) : btn;
            target.style.transform = 'scale(1)';
        });
    };

    function goToInicio() {
        resetMapProgress();
        changeScreen('inicio');
    }

    fastClick(btnJugar, () => changeScreen('elegirPersonaje'));
    fastClick(btnInstrucciones, () => changeScreen('instrucciones'));

    fastClick(btnVolverInst, () => goToInicio());
    fastClick(btnContinuarInst, () => changeScreen('elegirPersonaje'));
    fastClick(btnVolverPersonaje, () => goToInicio());
    fastClick(btnVolverJuego, () => goToInicio());
    fastClick(btnVolverVideo, () => {
        finalVideo.pause();
        finalVideo.currentTime = 0;
        goToInicio();
    });
    fastClick(btnVolverMapa, () => goToInicio());
    fastClick(btnVolverPreguntaId, () => changeScreen('mapaNodos'));
    fastClick(btnVolverPreguntaTr, () => changeScreen('mapaNodos'));
    if (btnCompleteHome) {
        btnCompleteHome.style.display = 'none';
    }

    // Evento para disparar el video final
    fastClick(rpTriggerBtn, () => {
        changeScreen('video');
        finalVideo.currentTime = 0;
        finalVideo.play();
    });

    // Detectar cuando el video termina para hacer la transición
    finalVideo.addEventListener('ended', () => {
        setTimeout(() => {
            finalVideo.pause();
            finalVideo.currentTime = 0;
            setMapPosition('rp');
            changeScreen('mapaNodos');
        }, 500);
    });

    let isSavingTeamName = false;

    async function submitTeamName() {
        const value = (teamNameInput?.value || '').trim();
        if (!value) {
            showToast('Ingresa el nombre del equipo.', 'error');
            if (teamNameInput) teamNameInput.focus();
            return;
        }
        if (!supabaseClient) {
            showToast('Supabase no está listo.', 'error');
            return;
        }
        if (isSavingTeamName) return;
        isSavingTeamName = true;
        try {
            const matchId = getMatchId();
            let data = null;
            let error = null;

            ({ data, error } = await supabaseClient
                .from('sessions')
                .insert({ name: value, score: 0, match_id: matchId })
                .select('id,name,score,created_at,match_id')
                .single());

            if (error) {
                ({ data, error } = await supabaseClient
                    .from('sessions')
                    .insert({ name: value, score: 0 })
                    .select('id,name,score,created_at')
                    .single());
            }

            if (error || !data) {
                showToast('No se pudo guardar.', 'error');
                return;
            }
            localStorage.setItem('teamName', data.name);
            localStorage.setItem('sessionId', data.id);
            changeScreen('inicio');
            showToast(`Equipo: ${data.name}`, 'success');
        } finally {
            isSavingTeamName = false;
        }
    }

    if (btnTeamContinue) fastClick(btnTeamContinue, submitTeamName);
    if (teamNameInput) {
        teamNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitTeamName();
            }
        });
    }

    // --- Lógica del Selector de Personajes ---
    const track = document.getElementById('character-track');
    const items = document.querySelectorAll('.character-item');
    const activeCharImg = document.getElementById('active-character-img');
    
    // Mapeo de personajes a sus imágenes
    const characterImages = {
        'Analista': 'Analista retro con lupa y gráficos.png',
        'Arquitecto': 'Arquitecto aventurero con planos.png',
        'Chica': 'Chica superviviente en mundo post-apocalíptico.png',
        'Sonic': 'sonic.png'
    };

    let selectedCharacterName = null;
    let selectedCharacterSrc = '';
    let mapPosition = 'rp';
    const activatedNodes = { rp: true, id: false, tr: false, su: false, ct: false, in: false, ci: false, mk: false, so: false, an: false, mp: false, es: false };
    let toastTimer = null;
    let mapViewportInitialized = false;
    let activeQuizKey = null;

    function resetMapProgress() {
        activatedNodes.rp = true;
        activatedNodes.id = false;
        activatedNodes.tr = false;
        activatedNodes.su = false;
        activatedNodes.ct = false;
        activatedNodes.in = false;
        activatedNodes.ci = false;
        activatedNodes.mk = false;
        activatedNodes.so = false;
        activatedNodes.an = false;
        activatedNodes.mp = false;
        activatedNodes.es = false;

        activeQuizKey = null;
        if (mapQuiz) mapQuiz.classList.add('hidden');
        if (completeOverlay) completeOverlay.classList.remove('show');
        if (toast) toast.classList.remove('show');

        mapPosition = 'rp';

        if (screens.mapaNodos && screens.mapaNodos.classList.contains('active')) {
            updateNodeAvailability();
            updateLineStates();
            updateLines();
            syncSelectedCharacter();
            positionCharacterAt('rp');
            scrollToNode('rp', 'auto');
        }
    }

    const quizDefs = {
        id: {
            question: '¿Por qué el nodo ID-01 (Diseño de BD) debe completarse antes que ID-02 (API de Autenticación)?',
            a: 'A) Porque ambos pueden hacerse simultáneamente sin problema',
            b: 'B) Porque la API necesita una estructura de datos existente para autenticar usuarios',
            c: 'C) Porque el diseño de BD es más fácil y se hace primero por costumbre',
            correct: 'B',
            success: 'id',
            failStay: 'rp',
            failMsg: 'Respuesta incorrecta. Sigues en RP.'
        },
        tr: {
            question: 'El nodo TR-01 tiene una holgura de H=6. ¿Qué significa eso para el proyecto?',
            a: 'A) Que debe ejecutarse 6 unidades antes de lo planeado',
            b: 'B) Que es un nodo crítico y cualquier retraso impacta el proyecto',
            c: 'C) Que puede retrasarse hasta 6 unidades de tiempo sin afectar la fecha de entrega',
            correct: 'C',
            success: 'tr',
            failStay: 'rp',
            failMsg: 'Respuesta incorrecta. Sigues en RP.'
        },
        su: {
            question: '¿Por qué SU-01 depende directamente de RP-06 y no de ID-04?',
            a: 'A) Porque SU es independiente de toda la rama principal',
            b: 'B) Porque necesita la arquitectura y contratos API definidos, no que la identidad esté completa',
            c: 'C) Porque las suscripciones no tienen relación con la identidad del usuario',
            correct: 'B',
            success: 'su',
            failStay: 'id',
            failMsg: 'Respuesta incorrecta. Sigues en ID.'
        },
        ct: {
            question: 'CT-01 y TR-01 arrancan al mismo tiempo desde RP-06. ¿Qué concepto del grafo representa esto?',
            a: 'A) Ruta crítica compartida entre ambos módulos',
            b: 'B) Dependencia secuencial — CT espera a que TR termine',
            c: 'C) Ejecución en paralelo — dos ramas independientes que parten del mismo nodo',
            correct: 'C',
            success: 'ct',
            failStay: 'tr',
            failMsg: 'Respuesta incorrecta. Sigues en TR.'
        },
        in_su: {
            question: 'El nodo IN-01 requiere que tanto ID-04 como SU-03 estén completos. ¿Qué tipo de dependencia es esta?',
            a: 'A) Secuencial simple — depende de un solo nodo anterior',
            b: 'B) Convergencia — un nodo que espera múltiples predecesores antes de iniciar',
            c: 'C) Divergencia — un nodo que lanza múltiples ramas simultáneas',
            correct: 'B',
            success: 'in',
            failStay: 'su',
            failMsg: 'Respuesta incorrecta. Sigues en SU.'
        },
        in_ct: {
            question: 'IN-02 integra TR-04 y CT-03. Si CT-03 termina a tiempo pero TR-04 se retrasa 3 unidades, ¿qué ocurre?',
            a: 'A) El retraso de TR-04 no afecta a IN-02 porque CT-03 ya está listo',
            b: 'B) IN-02 puede iniciar con solo CT-03 completado',
            c: 'C) IN-02 no puede iniciar hasta que TR-04 termine, retrasando todo lo que depende de IN-02',
            correct: 'C',
            success: 'in',
            failStay: 'ct',
            failMsg: 'Respuesta incorrecta. Sigues en CT.'
        },
        ci: {
            question: 'CI-01 (Pruebas E2E) tiene H=0 y depende de AH-04, IN-02, IN-03 e IN-04. ¿Qué implica esto?',
            a: 'A) Que CI-01 puede iniciar cuando al menos dos de esos nodos estén listos',
            b: 'B) Que todos esos módulos deben estar 100% listos; cualquier retraso en uno retrasa el cierre completo',
            c: 'C) Que CI-01 tiene margen para esperar porque está al final del proyecto',
            correct: 'B',
            success: 'ci',
            failStay: 'in',
            failMsg: 'Respuesta incorrecta. Sigues en IN.'
        },
        mk: {
            question: '¿Por qué MK no aparece en la ruta crítica del grafo de FinTrack?',
            a: 'A) Porque MK depende de CI y por eso queda fuera del grafo',
            b: 'B) Porque marketing no es importante para una startup FinTech',
            c: 'C) Porque tiene holgura — su retraso no impacta directamente la fecha de entrega del software',
            correct: 'C',
            success: 'mk',
            failStay: 'ci',
            failMsg: 'Respuesta incorrecta. Sigues en CI.'
        },
        so: {
            question: 'En el grafo, SO es un nodo posterior al lanzamiento (CI-05). ¿Qué concepto representa su posición?',
            a: 'A) Un nodo crítico que bloquea el lanzamiento si no está listo',
            b: 'B) Una actividad sucesora que solo puede iniciar después de que el producto esté en producción',
            c: 'C) Una actividad paralela que se ejecuta desde el inicio del proyecto',
            correct: 'B',
            success: 'so',
            failStay: 'mk',
            failMsg: 'Respuesta incorrecta. Sigues en MK.'
        },
        an: {
            question: 'El nodo RE (Reportes) tiene H=12 en sus primeras etapas. ¿Qué decisión estratégica permite esto?',
            a: 'A) Adelantar RE para que se vuelva parte de la ruta crítica',
            b: 'B) Reasignar temporalmente recursos de RE a nodos críticos sin retrasar el proyecto',
            c: 'C) Eliminar el módulo de reportes del alcance del proyecto',
            correct: 'B',
            success: 'an',
            failStay: 'so',
            failMsg: 'Respuesta incorrecta. Sigues en SO.'
        },
        mp: {
            question: 'RP-04 (Onboarding) tiene H=0 y consume 12 unidades de tiempo. ¿Qué recomendaría el análisis PERT para este nodo?',
            a: 'A) Ignorarlo porque es solo capacitación y no afecta el desarrollo técnico',
            b: 'B) Moverlo al final del proyecto para no bloquear las fases técnicas',
            c: 'C) Optimizarlo o automatizarlo porque es crítico y consume mucho tiempo en la ruta',
            correct: 'C',
            success: 'mp',
            failStay: 'an',
            failMsg: 'Respuesta incorrecta. Sigues en AN.'
        },
        es: {
            question: 'El proyecto tiene una desviación estándar total de ~4.6 unidades. ¿Qué significa para la fecha de entrega?',
            a: 'A) Que existe incertidumbre estadística — la entrega real podría variar alrededor de las 124 unidades esperadas',
            b: 'B) Que el proyecto está mal planificado y debe rehacerse',
            c: 'C) Que el proyecto definitivamente terminará en exactamente 124 unidades',
            correct: 'A',
            success: 'es',
            failStay: 'mp',
            failMsg: 'Respuesta incorrecta. Sigues en MP.'
        }
    };

    function initMapViewport() {
        if (!mapViewport || !mapCanvas) return;
        if (!mapViewportInitialized) {
            mapViewportInitialized = true;

            let isPanning = false;
            let startX = 0;
            let startY = 0;
            let startScrollTop = 0;

            mapViewport.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('.node-btn, .quiz-option, .quiz-cancel, .back-button')) return;
                isPanning = true;
                startX = e.clientX;
                startY = e.clientY;
                startScrollTop = mapViewport.scrollTop;
                mapViewport.setPointerCapture(e.pointerId);
            });

            mapViewport.addEventListener('pointermove', (e) => {
                if (!isPanning) return;
                const dy = e.clientY - startY;
                mapViewport.scrollTop = startScrollTop - dy;
            });

            mapViewport.addEventListener('pointerup', (e) => {
                if (!isPanning) return;
                isPanning = false;
                try {
                    mapViewport.releasePointerCapture(e.pointerId);
                } catch {}
            });
        }

        mapViewport.scrollLeft = 0;
        scrollToNode(mapPosition, 'auto');
    }

    function getMapAnchor(position) {
        if (position === 'id') return btnNodeId;
        if (position === 'tr') return btnNodeTr;
        if (position === 'su') return btnNodeSu;
        if (position === 'ct') return btnNodeCt;
        if (position === 'in') return btnNodeIn;
        if (position === 'ci') return btnNodeCi;
        if (position === 'mk') return btnNodeMk;
        if (position === 'so') return btnNodeSo;
        if (position === 'an') return btnNodeAn;
        if (position === 'mp') return btnNodeMp;
        if (position === 'es') return btnNodeEs;
        if (position === 'rp') return nodeRp;
        return null;
    }

    function scrollToNode(position, behavior = 'smooth') {
        if (!mapViewport) return;
        if (!screens.mapaNodos.classList.contains('active')) return;
        const anchor = getMapAnchor(position);
        if (!anchor) return;
        anchor.scrollIntoView({ behavior, block: 'center', inline: 'center' });
    }

    function updateNodeAvailability() {
        if (btnNodeId) btnNodeId.disabled = mapPosition !== 'rp';
        if (btnNodeTr) btnNodeTr.disabled = mapPosition !== 'rp';
        if (btnNodeSu) btnNodeSu.disabled = mapPosition !== 'id';
        if (btnNodeCt) btnNodeCt.disabled = mapPosition !== 'tr';
        if (btnNodeIn) btnNodeIn.disabled = !(mapPosition === 'su' || mapPosition === 'ct');
        if (btnNodeCi) btnNodeCi.disabled = !(mapPosition === 'in' && activatedNodes.in);
        if (btnNodeMk) btnNodeMk.disabled = !(mapPosition === 'ci' && activatedNodes.ci);
        if (btnNodeSo) btnNodeSo.disabled = !(mapPosition === 'mk' && activatedNodes.mk);
        if (btnNodeAn) btnNodeAn.disabled = !(mapPosition === 'so' && activatedNodes.so);
        if (btnNodeMp) btnNodeMp.disabled = !(mapPosition === 'an' && activatedNodes.an);
        if (btnNodeEs) btnNodeEs.disabled = !(mapPosition === 'mp' && activatedNodes.mp);
    }

    function setLineState(line, active) {
        if (!line) return;
        line.classList.remove('active', 'dim');
        line.classList.add(active ? 'active' : 'dim');
    }

    function updateLineStates() {
        setLineState(lineRpId, activatedNodes.id);
        setLineState(lineRpTr, activatedNodes.tr);
        setLineState(lineIdSu, activatedNodes.su);
        setLineState(lineTrCt, activatedNodes.ct);
        setLineState(lineSuIn, activatedNodes.in && activatedNodes.su);
        setLineState(lineCtIn, activatedNodes.in && activatedNodes.ct);
        setLineState(lineInCi, activatedNodes.ci);
        setLineState(lineCiMk, activatedNodes.mk);
        setLineState(lineMkSo, activatedNodes.so);
        setLineState(lineSoAn, activatedNodes.an);
        setLineState(lineAnMp, activatedNodes.mp);
        setLineState(lineMpEs, activatedNodes.es);
    }

    function positionCharacterAt(position) {
        if (!screens.mapaNodos || !mapCharacterDisplay || !mapCanvas) return;
        const anchor = getMapAnchor(position);
        if (!anchor) return;
        requestAnimationFrame(() => {
            const canvasRect = mapCanvas.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();
            if (!canvasRect.width || !anchorRect.width) return;

            const charRect = mapCharacterDisplay.getBoundingClientRect();
            const charW = charRect.width || 0;
            const charH = charRect.height || 0;

            const rawX = anchorRect.left - canvasRect.left + anchorRect.width / 2;
            const footFactor = 0.85;
            const rawBottomY = anchorRect.top - canvasRect.top + anchorRect.height * footFactor;

            const minX = charW ? (charW / 2 + 8) : 0;
            const maxX = charW ? (mapCanvas.clientWidth - charW / 2 - 8) : mapCanvas.clientWidth;
            const x = Math.min(Math.max(rawX, minX), maxX);

            const minBottomY = charH ? (charH + 8) : 0;
            const maxBottomY = mapCanvas.clientHeight - 8;
            const bottomY = Math.min(Math.max(rawBottomY, minBottomY), maxBottomY);

            mapCharacterDisplay.style.left = `${x}px`;
            mapCharacterDisplay.style.top = `${bottomY}px`;
        });
    }

    function showToast(message, variant) {
        if (!toast) return;
        if (toastTimer) clearTimeout(toastTimer);
        const normalized = String(message ?? '');
        const teamMatch = normalized.match(/^\s*Equipo:\s*(.+)\s*$/i);
        toast.textContent = teamMatch ? `Equipo\n${teamMatch[1]}` : normalized;
        toast.classList.remove('error', 'success', 'show');
        if (variant) toast.classList.add(variant);
        requestAnimationFrame(() => toast.classList.add('show'));
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
    }

    function setMapPosition(nextPosition) {
        mapPosition = nextPosition;
        if (screens.mapaNodos && screens.mapaNodos.classList.contains('active')) {
            positionCharacterAt(nextPosition);
            updateNodeAvailability();
            updateLineStates();
            updateLines();
            scrollToNode(nextPosition);
        }

        if (completeOverlay) completeOverlay.classList.remove('show');

        if (nextPosition === 'rp') {
            if (mapStatusText) mapStatusText.textContent = 'Elige un nodo: ID o TR';
        } else if (nextPosition === 'id') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo ID activado';
        } else if (nextPosition === 'tr') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo TR activado';
        } else if (nextPosition === 'su') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo SU activado';
        } else if (nextPosition === 'ct') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo CT activado';
        } else if (nextPosition === 'in') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo IN activado';
        } else if (nextPosition === 'ci') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo CI activado';
        } else if (nextPosition === 'mk') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo MK activado';
        } else if (nextPosition === 'so') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo SO activado';
        } else if (nextPosition === 'an') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo AN activado';
        } else if (nextPosition === 'mp') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo MP activado';
        } else if (nextPosition === 'es') {
            if (mapStatusText) mapStatusText.textContent = 'Nodo ES activado';
        }
    }

    function syncSelectedCharacter() {
        if (mapCharacterImg) mapCharacterImg.src = selectedCharacterSrc || '';
    }

    let currentIndex = 0;
    let startX = 0;
    let isDragging = false;

    function updateCarousel() {
        const offset = -currentIndex * 100;
        track.style.transform = `translateX(${offset}%)`;
        
        // Actualizar clase activa para animaciones
        items.forEach((item, index) => {
            if (index === currentIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Sin dots para no interferir con el botón JUGAR
    }

    // Sin listeners de dots: la navegación es por swipe en pantalla

    // Eventos de Touch
    track.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    });

    track.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        // Solo para feedback visual ligero (opcional)
    });

    track.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;

        // Umbral para considerar un swipe (50px)
        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentIndex < items.length - 1) {
                currentIndex++;
            } else if (diff < 0 && currentIndex > 0) {
                currentIndex--;
            }
        }
        updateCarousel();
        isDragging = false;
    });

    // Soporte para Mouse (para probar en PC)
    track.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        isDragging = true;
    });

    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        const endX = e.clientX;
        const diff = startX - endX;

        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentIndex < items.length - 1) {
                currentIndex++;
            } else if (diff < 0 && currentIndex > 0) {
                currentIndex--;
            }
        }
        updateCarousel();
        isDragging = false;
    });

    // Botón Confirmar Personaje con mayor sensibilidad
    const btnConfirmar = document.getElementById('btn-confirmar-personaje');
    fastClick(btnConfirmar, () => {
        selectedCharacterName = items[currentIndex].getAttribute('data-name');
        
        // Asignar la imagen del personaje seleccionado para la pantalla de juego
        selectedCharacterSrc = characterImages[selectedCharacterName] || '';
        activeCharImg.src = selectedCharacterSrc;
        syncSelectedCharacter();

        const sessionId = getSessionId();
        if (supabaseClient && sessionId) {
            supabaseClient
                .from('sessions')
                .update({ character: selectedCharacterName })
                .eq('id', sessionId);
        }
        
        // 1. Ir a la pantalla de espera
        changeScreen('espera');
        
        // 2. Esperar 3 segundos
        setTimeout(() => {
            // 3. Cambiar a la pantalla del Nodo Inicial
            changeScreen('nodoInicial');
        }, 3000);
    });

    // Inicializar carrusel
    updateCarousel();

    function openMapQuiz(key) {
        if (penaltyActive) return;
        if (!mapQuiz || !mapQuizQuestion || !mapQuizA || !mapQuizB || !mapQuizC) return;
        const def = quizDefs[key];
        if (!def) return;
        activeQuizKey = key;
        mapQuizQuestion.textContent = def.question;
        mapQuizA.textContent = def.a;
        mapQuizB.textContent = def.b;
        mapQuizC.textContent = def.c;
        mapQuiz.classList.remove('hidden');
    }

    function closeMapQuiz() {
        if (!mapQuiz) return;
        activeQuizKey = null;
        mapQuiz.classList.add('hidden');
    }

    function answerMapQuiz(option) {
        const def = quizDefs[activeQuizKey];
        if (!def) return;
        closeMapQuiz();
        if (option !== def.correct) {
            wrongStreak += 1;
            const seconds = wrongStreak === 1 ? 5 : 10;
            const msg = (def.failMsgs && def.failMsgs[option]) ? def.failMsgs[option] : def.failMsg;
            if (msg) showToast(msg, 'error');
            setMapPosition(def.failStay);
            startPenalty(seconds);
            return;
        }
        wrongStreak = 0;
        activatedNodes[def.success] = true;
        setMapPosition(def.success);
        if (def.success === 'es') {
            if (completeOverlay) completeOverlay.classList.add('show');
            markFinishedOnce();
            setTimeout(() => {
                changeScreen('puestos');
                startRankingPolling();
            }, 1200);
            return;
        }
        showToast('Correcto.', 'success');
    }

    if (mapQuizCancel) fastClick(mapQuizCancel, closeMapQuiz);
    if (mapQuizA) fastClick(mapQuizA, () => answerMapQuiz('A'));
    if (mapQuizB) fastClick(mapQuizB, () => answerMapQuiz('B'));
    if (mapQuizC) fastClick(mapQuizC, () => answerMapQuiz('C'));

    if (btnNodeId) fastClick(btnNodeId, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'rp') return;
        openMapQuiz('id');
    });

    if (btnNodeTr) fastClick(btnNodeTr, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'rp') return;
        openMapQuiz('tr');
    });

    if (btnNodeSu) fastClick(btnNodeSu, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'id') return;
        openMapQuiz('su');
    });

    if (btnNodeCt) fastClick(btnNodeCt, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'tr') return;
        openMapQuiz('ct');
    });

    if (btnNodeIn) fastClick(btnNodeIn, () => {
        if (penaltyActive) return;
        if (mapPosition === 'su') {
            openMapQuiz('in_su');
            return;
        }
        if (mapPosition === 'ct') {
            openMapQuiz('in_ct');
        }
    });

    if (btnNodeCi) fastClick(btnNodeCi, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'in') return;
        if (!activatedNodes.in) return;
        openMapQuiz('ci');
    });

    if (btnNodeMk) fastClick(btnNodeMk, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'ci') return;
        if (!activatedNodes.ci) return;
        openMapQuiz('mk');
    });

    if (btnNodeSo) fastClick(btnNodeSo, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'mk') return;
        if (!activatedNodes.mk) return;
        openMapQuiz('so');
    });

    if (btnNodeAn) fastClick(btnNodeAn, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'so') return;
        if (!activatedNodes.so) return;
        openMapQuiz('an');
    });

    if (btnNodeMp) fastClick(btnNodeMp, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'an') return;
        if (!activatedNodes.an) return;
        openMapQuiz('mp');
    });

    if (btnNodeEs) fastClick(btnNodeEs, () => {
        if (penaltyActive) return;
        if (mapPosition !== 'mp') return;
        if (!activatedNodes.mp) return;
        openMapQuiz('es');
    });

    // --- Lógica de la Intro ---
    function finishIntro() {
        introVideo.pause();
        const existing = (localStorage.getItem('teamName') || '').trim();
        if (teamNameInput) teamNameInput.value = existing;
        changeScreen('ingresaNombre');
        setTimeout(() => {
            if (teamNameInput) teamNameInput.focus();
        }, 350);
    }

    window.addEventListener('resize', () => {
        positionCharacterAt(mapPosition);
        updateLines();
    });

    function startMusic() {
        bgMusic.play().catch(error => {
            console.log("Música bloqueada, esperando interacción adicional");
        });
    }

    // Al iniciar la experiencia (clic inicial)
    fastClick(btnStartGame, () => {
        // Ocultar overlay
        introOverlay.style.display = 'none';
        // Mostrar botón skip
        btnSkipIntro.style.display = 'block';
        
        // Iniciar música inmediatamente
        startMusic();
        
        // Iniciar video de intro
        introVideo.play().catch(error => {
            console.log("Error al reproducir video intro");
        });
    });

    // Al terminar el video de intro
    introVideo.addEventListener('ended', finishIntro);

    // Botón para saltar intro
    fastClick(btnSkipIntro, finishIntro);

    // Inicializar la pantalla de intro
    screens.intro.classList.add('active');
    screens.intro.style.display = 'flex';
});
