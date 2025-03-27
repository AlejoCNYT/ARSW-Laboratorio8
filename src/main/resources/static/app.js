/**
 * Módulo principal de la aplicación de pintura colaborativa
 * Usa STOMP sobre WebSockets para comunicación en tiempo real
 */
var app = (function () {
    // Variables de estado
    var stompClient = null;
    var subscribedTopics = new Set();
    var currentDrawingId = null;
    var connectionAttempts = 0;
    const MAX_RETRIES = 5;
    var connectionStatus = false;

    // Verificación inicial de dependencias
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
        console.error("Error: Faltan dependencias (SockJS o STOMP)");
        alert("Error crítico: Recarga la página e intenta nuevamente.");
        throw new Error("Dependencias faltantes");
    }

    /**
     * Conecta al WebSocket y se suscribe al tópico del dibujo
     * @param {string} drawingId - ID del dibujo al que conectarse
     */
    var connectAndSubscribe = function (drawingId) {
        if (connectionStatus && currentDrawingId === drawingId) {
            console.warn("Ya estás conectado a este dibujo.");
            return;
        }

        if (stompClient && stompClient.connected) {
            disconnect(true).then(() => internalConnect(drawingId));
        } else {
            internalConnect(drawingId);
        }
    };

    /**
     * Conexión interna con manejo de estados
     */
    var internalConnect = function(drawingId) {
        console.log(`Conectando a WS para: ${drawingId}`);
        currentDrawingId = drawingId;
        connectionStatus = false;

        try {
            var socket = new SockJS('/stompendpoint');
            stompClient = Stomp.over(socket);

            // Configuración robusta
            stompClient.heartbeat.outgoing = 10000;
            stompClient.heartbeat.incoming = 10000;
            stompClient.debug = null; // Desactiva logs detallados de STOMP

            stompClient.connect({},
                function(frame) {
                    connectionStatus = true;
                    connectionAttempts = 0;
                    console.log("Conexión establecida:", frame);
                    subscribeToTopic(drawingId);
                    updateUI();
                },
                function(error) {
                    console.error("Error de conexión:", error);
                    handleConnectionError(drawingId, error);
                }
            );
        } catch (e) {
            console.error("Error al crear cliente STOMP:", e);
            handleConnectionError(drawingId, e);
        }
    };

    /**
     * Desconexión controlada
     * @param {boolean} silent - Si true, no muestra mensajes
     * @returns {Promise} - Resuelve cuando la desconexión completa
     */
    var disconnect = function(silent = false) {
        return new Promise((resolve) => {
            if (!stompClient || !connectionStatus) {
                if (!silent) console.warn("No hay conexión activa");
                resolve();
                return;
            }

            stompClient.disconnect(() => {
                connectionStatus = false;
                currentDrawingId = null;
                subscribedTopics.clear();
                if (!silent) {
                    console.log("Desconexión completada");
                    updateUI();
                }
                resolve();
            });
        });
    };

    /**
     * Suscripción al tópico con validación
     */
    var subscribeToTopic = function(drawingId) {
        var topic = `/topic/newpoint.${drawingId}`;

        if (subscribedTopics.has(topic)) {
            console.warn("Ya suscrito a este tópico");
            return;
        }

        var subscription = stompClient.subscribe(topic, function(message) {
            try {
                var point = JSON.parse(message.body);
                if (validatePoint(point)) {
                    console.log("Punto recibido:", point);
                    addPointToCanvas(point);
                }
            } catch (e) {
                console.error("Error procesando punto:", e);
            }
        });

        subscribedTopics.add(topic);
        console.log("Suscrito correctamente a:", topic);
    };

    /**
     * Maneja errores de conexión con reintentos
     */
    var handleConnectionError = function(drawingId, error) {
        connectionAttempts++;
        connectionStatus = false;
        updateUI();

        if (connectionAttempts <= MAX_RETRIES) {
            console.log(`Reintentando conexión (${connectionAttempts}/${MAX_RETRIES})...`);
            setTimeout(() => connectAndSubscribe(drawingId), 3000);
        } else {
            console.error("Número máximo de reintentos alcanzado");
            alert("No se pudo conectar al servidor. Por favor recarga la página.");
        }
    };

    /**
     * Valida que un punto tenga coordenadas válidas
     */
    var validatePoint = function(point) {
        const canvas = document.getElementById("canvas");
        if (!canvas) return false;

        return point &&
            typeof point.x === 'number' && !isNaN(point.x) &&
            typeof point.y === 'number' && !isNaN(point.y) &&
            point.x >= 0 && point.x <= canvas.width &&
            point.y >= 0 && point.y <= canvas.height;
    };

    /**
     * Añade un punto al canvas
     */
    var addPointToCanvas = function(point) {
        if (!validatePoint(point)) {
            console.warn("Punto inválido:", point);
            return;
        }

        var canvas = document.getElementById("canvas");
        var ctx = canvas.getContext("2d");

        // Dibuja un círculo relleno
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = "#FF0000";
        ctx.fill();
        ctx.strokeStyle = "#AA0000";
        ctx.stroke();
    };

    /**
     * Actualiza la UI según el estado de conexión
     */
    var updateUI = function() {
        const statusElem = document.getElementById("connectionStatus");
        const connectBtn = document.getElementById("connectBtn");
        const disconnectBtn = document.getElementById("disconnectBtn");

        if (statusElem) {
            statusElem.textContent = connectionStatus ? "Conectado" : "Desconectado";
            statusElem.style.color = connectionStatus ? "green" : "red";
        }

        if (connectBtn) connectBtn.disabled = connectionStatus;
        if (disconnectBtn) disconnectBtn.disabled = !connectionStatus;
    };

    /**
     * Publica un punto en el dibujo actual
     */
    var publishPoint = function(px, py) {
        const point = { x: px, y: py };

        if (!currentDrawingId) {
            alert("No estás conectado a ningún dibujo. Conéctate primero.");
            return false;
        }

        if (!connectionStatus) {
            alert("No estás conectado al servidor. Conéctate primero.");
            return false;
        }

        if (!validatePoint(point)) {
            alert("Coordenadas inválidas para este canvas.");
            return false;
        }

        try {
            stompClient.send(`/app/newpoint.${currentDrawingId}`, {}, JSON.stringify(point));
            addPointToCanvas(point);
            return true;
        } catch (error) {
            console.error("Error enviando punto:", error);
            alert("Error al enviar punto. Verifica tu conexión.");
            return false;
        }
    };

    /**
     * Limpia el canvas completamente
     */
    var clearCanvas = function() {
        var canvas = document.getElementById("canvas");
        if (!canvas) return;

        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    /**
     * Inicializa la aplicación
     */
    var init = function() {
        // Configurar canvas inicial
        clearCanvas();

        // Evento de click en canvas
        document.getElementById("canvas")?.addEventListener("click", function(evt) {
            var rect = this.getBoundingClientRect();
            var x = evt.clientX - rect.left;
            var y = evt.clientY - rect.top;
            publishPoint(x, y);
        });

        // Botón de enviar punto
        document.getElementById("sendPointBtn")?.addEventListener("click", function() {
            var x = parseFloat(document.getElementById("x").value);
            var y = parseFloat(document.getElementById("y").value);

            if (isNaN(x) || isNaN(y)) {
                alert("Por favor ingrese valores numéricos válidos.");
                return;
            }

            publishPoint(x, y);
        });

        // Botón de conectar
        document.getElementById("connectBtn")?.addEventListener("click", function() {
            var drawingId = document.getElementById("drawingId").value.trim();
            if (drawingId) {
                connectAndSubscribe(drawingId);
            } else {
                alert("Ingrese un ID de dibujo válido.");
            }
        });

        // Botón de desconectar
        document.getElementById("disconnectBtn")?.addEventListener("click", disconnect);

        // Botón de limpiar canvas
        document.getElementById("clearBtn")?.addEventListener("click", clearCanvas);

        console.log("Aplicación inicializada correctamente");
    };

    // Hacer funciones accesibles globalmente
    return {
        init: init,
        connectAndSubscribe: connectAndSubscribe,
        publishPoint: publishPoint,
        disconnect: disconnect,
        getCurrentDrawingId: () => currentDrawingId,
        isConnected: () => connectionStatus
    };
})();

// Inicialización cuando el DOM esté listo
window.app = app;
document.addEventListener("DOMContentLoaded", function() {
    app.init();
});