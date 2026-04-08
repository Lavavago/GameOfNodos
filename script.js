document.addEventListener('DOMContentLoaded', () => {
    const screens = {
        intro: document.getElementById('screen-intro'),
        inicio: document.getElementById('screen-inicio'),
        instrucciones: document.getElementById('screen-instrucciones'),
        elegirPersonaje: document.getElementById('screen-elegirPersonaje'),
        espera: document.getElementById('screen-espera'),
        nodoInicial: document.getElementById('screen-nodo-inicial'),
        video: document.getElementById('screen-video')
    };

    const overlay = document.getElementById('transition-overlay');
    const introVideo = document.getElementById('intro-video');
    const btnSkipIntro = document.getElementById('btn-skip-intro');
    const bgMusic = document.getElementById('bg-music');
    const introOverlay = document.getElementById('intro-overlay');
    const btnStartGame = document.getElementById('btn-start-game');

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
            btn.style.transform = 'scale(0.95)';
        });
        
        btn.addEventListener('pointerup', () => {
            btn.style.transform = 'scale(1)';
        });
        
        btn.addEventListener('pointerleave', () => {
            btn.style.transform = 'scale(1)';
        });
    };

    fastClick(btnJugar, () => changeScreen('elegirPersonaje'));
    fastClick(btnInstrucciones, () => changeScreen('instrucciones'));

    fastClick(btnVolverInst, () => changeScreen('inicio'));
    fastClick(btnContinuarInst, () => changeScreen('elegirPersonaje'));
    fastClick(btnVolverPersonaje, () => changeScreen('inicio'));
    fastClick(btnVolverJuego, () => changeScreen('inicio'));
    fastClick(btnVolverVideo, () => {
        finalVideo.pause();
        finalVideo.currentTime = 0;
        changeScreen('inicio');
    });

    // Evento para disparar el video final
    fastClick(rpTriggerBtn, () => {
        changeScreen('video');
        finalVideo.play();
    });

    // Detectar cuando el video termina para hacer la transición
    finalVideo.addEventListener('ended', () => {
        // Pequeña espera antes de la transición de salida
        setTimeout(() => {
            changeScreen('inicio'); // Por ahora vuelve al inicio, o a donde prefieras
        }, 500);
    });

    // --- Lógica del Selector de Personajes ---
    const track = document.getElementById('character-track');
    const items = document.querySelectorAll('.character-item');
    const dots = document.querySelectorAll('.dot');
    const activeCharImg = document.getElementById('active-character-img');
    
    // Mapeo de personajes a sus imágenes
    const characterImages = {
        'Analista': 'Analista retro con lupa y gráficos.png',
        'Arquitecto': 'Arquitecto aventurero con planos.png',
        'Chica': 'Chica superviviente en mundo post-apocalíptico.png',
        'Sonic': 'sonic.png'
    };

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

        // Actualizar dots
        dots.forEach((dot, index) => {
            if (index === currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    // Permitir clic en los dots
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentIndex = index;
            updateCarousel();
        });
    });

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
        const selectedChar = items[currentIndex].getAttribute('data-name');
        
        // Asignar la imagen del personaje seleccionado para la pantalla de juego
        activeCharImg.src = characterImages[selectedChar];
        
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

    // --- Lógica de la Intro ---
    function finishIntro() {
        introVideo.pause();
        changeScreen('inicio');
    }

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
