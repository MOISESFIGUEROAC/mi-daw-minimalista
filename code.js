document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DEL DOM ---
    const startModal = document.getElementById('start-modal');
    const startButton = document.getElementById('start-button');
    const playButton = document.getElementById('play-button');
    const bpmInput = document.getElementById('bpm-input');
    const tracks = document.querySelectorAll('.track');
    const draggableItems = document.querySelectorAll('.draggable-item');
    const metroLight = document.getElementById('metro-light');
    const timeDisplay = document.getElementById('time-display');
    const exportButton = document.getElementById('export-button');

    // --- ESTADO DE LA APLICACIÓN ---
    let isPlaying = false;
    // Usamos un objeto para almacenar los reproductores de audio de Tone.js
    // La clave será un ID único que generaremos para cada clip
    const audioPlayers = {}; 

    // --- INICIALIZACIÓN DE TONE.JS ---
    // Tone.js debe ser iniciado por una interacción del usuario.
    startButton.addEventListener('click', async () => {
        await Tone.start();
        console.log('AudioContext iniciado.');
        startModal.style.display = 'none';
        initializeDAW();
    });

    function initializeDAW() {
        // Configuración inicial del transporte (metrónomo global)
        Tone.Transport.bpm.value = parseInt(bpmInput.value);
        Tone.Transport.scheduleRepeat(onBeat, '4n'); // Llama a onBeat cada negra

        // Sincronizar la pantalla de tiempo
        requestAnimationFrame(updateTimeDisplay);
    }
    
    // --- LÓGICA DE TRANSPORTE Y METRÓNOMO ---
    playButton.addEventListener('click', () => {
        if (isPlaying) {
            Tone.Transport.stop();
            playButton.textContent = '▶';
        } else {
            Tone.Transport.start();
            playButton.textContent = '■';
        }
        isPlaying = !isPlaying;
    });

    bpmInput.addEventListener('change', (e) => {
        const newBpm = parseInt(e.target.value);
        if (newBpm > 20 && newBpm < 300) {
            Tone.Transport.bpm.value = newBpm;
        }
    });

    // Función que se ejecuta en cada beat del metrónomo
    function onBeat(time) {
        // Usamos Draw.schedule para asegurar que la animación se sincronice con el audio
        Tone.Draw.schedule(() => {
            metroLight.classList.add('active');
            setTimeout(() => metroLight.classList.remove('active'), 50);
        }, time);
    }
    
    // Función para actualizar el display de tiempo (compás:beat:subdivisión)
    function updateTimeDisplay() {
        if (isPlaying) {
             const time = Tone.Transport.position.split('.')[0]; // Formato "bars:beats:sixteenths"
             timeDisplay.textContent = time;
        } else {
            timeDisplay.textContent = "0:0:0";
        }
       requestAnimationFrame(updateTimeDisplay);
    }

    // --- LÓGICA DE DRAG AND DROP ---
    let draggedItem = null;

    draggableItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = e.target;
            // Pequeña espera para que el navegador capture la apariencia del elemento
            setTimeout(() => e.target.style.display = 'none', 0);
        });

        item.addEventListener('dragend', (e) => {
            // El elemento original vuelve a su sitio si no se suelta en un lugar válido
            draggedItem.style.display = 'block';
            draggedItem = null;
        });
    });

    tracks.forEach(track => {
        track.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necesario para permitir el drop
            track.classList.add('drag-over');
        });

        track.addEventListener('dragleave', () => {
            track.classList.remove('drag-over');
        });

        track.addEventListener('drop', (e) => {
            e.preventDefault();
            track.classList.remove('drag-over');

            if (draggedItem) {
                // Obtener posición del drop
                const trackRect = track.getBoundingClientRect();
                const dropX = e.clientX - trackRect.left;
                
                // Convertir posición X a tiempo musical
                const pixelsPerBeat = 50; // Corresponde al tamaño de la rejilla en CSS
                const beat = Math.floor(dropX / pixelsPerBeat);
                const bar = Math.floor(beat / 4);
                const quarter = beat % 4;
                const startTime = `${bar}:${quarter}:0`;
                
                // Crear el clip visual y de audio
                createClip(draggedItem, track, dropX, startTime);
            }
        });
    });

    /**
     * Crea un clip visual en la pista y un reproductor de audio en Tone.js
     * @param {HTMLElement} sourceItem - El elemento original arrastrado.
     * @param {HTMLElement} targetTrack - La pista donde se soltó.
     * @param {number} positionX - La posición en píxeles dentro de la pista.
     * @param {string} startTime - El tiempo musical (ej: "0:2:0").
     */
    function createClip(sourceItem, targetTrack, positionX, startTime) {
        // 1. Crear el elemento visual del clip
        const clipElement = document.createElement('div');
        const clipId = `clip-${Date.now()}`; // ID único para el clip
        clipElement.id = clipId;
        clipElement.classList.add('clip');
        clipElement.textContent = sourceItem.dataset.name;
        clipElement.style.left = `${positionX}px`;

        if (sourceItem.classList.contains('loop-item')) {
            clipElement.classList.add('loop-clip');
        } else {
            clipElement.classList.add('sample-clip');
        }

        targetTrack.appendChild(clipElement);

        // 2. Crear el reproductor de audio con Tone.js
        const audioSrc = sourceItem.dataset.src;
        
        // Creamos un reproductor de Tone.Player, que puede cargar un buffer de audio
        const player = new Tone.Player(audioSrc, () => {
             console.log(`Audio '${sourceItem.dataset.name}' cargado.`);
             // Una vez cargado, lo podemos programar
        }).toDestination(); // Conectarlo a la salida de audio principal

        // Guardar el reproductor para poder acceder a él más tarde
        audioPlayers[clipId] = player;

        // 3. Programar la reproducción en el transporte de Tone.js
        if (sourceItem.classList.contains('loop-item')) {
            // Si es un loop, se repite hasta que se detenga
            const loop = new Tone.Loop(time => {
                player.start(time);
            }, player.buffer.duration).start(startTime);
            audioPlayers[clipId].loopRef = loop; // Guardamos referencia al loop para poder pararlo
        } else {
            // Si es un sample, se reproduce una sola vez
            Tone.Transport.scheduleOnce(time => {
                player.start(time);
            }, startTime);
        }
        
        // Añadir comentario sobre la funcionalidad de repetición (x1, x2, x4...)
        // TODO: Añadir un control al clipElement para definir repeticiones.
        // Esto implicaría ajustar la duración del Tone.Loop o programar múltiples
        // eventos en Tone.Transport.schedule.
    }
    
    // --- FUNCIONALIDAD AVANZADA (PLACEHOLDERS) ---
    exportButton.addEventListener('click', () => {
        alert('Funcionalidad de Exportar en desarrollo.\n\nPara implementarla, se necesitaría usar un OfflineAudioContext para renderizar el audio del transporte de Tone.js a un buffer, y luego convertir ese buffer a un formato como WAV.');
    });

    // TODO: Implementar la reordenación y adición de "structure-tag".
    // Se podría usar una librería como SortableJS para hacerlos arrastrables fácilmente.
});