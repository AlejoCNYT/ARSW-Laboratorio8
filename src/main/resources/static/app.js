var app = (function () {
    var stompClient = null;

    var connectAndSubscribe = function (drawingId) {
        console.info('Conectando a WS para el dibujo: ' + drawingId);
        var socket = new SockJS('/stompendpoint');
        stompClient = Stomp.over(socket);

        stompClient.connect({}, function (frame) {
            console.log('Conectado: ' + frame);
            let topic = "/topic/newpoint." + drawingId; // Tópico dinámico basado en el ID

            stompClient.subscribe(topic, function (message) {
                console.log("Mensaje recibido en " + topic + ":", message.body);
                var theObject = JSON.parse(message.body);
                alert("Nuevo punto recibido en " + drawingId + ": (" + theObject.x + ", " + theObject.y + ")");
                addPointToCanvas(theObject);
            });
        });
    };

    function addPointToCanvas(point) {
        var canvas = document.getElementById("canvas");
        var ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = "red";
        ctx.fill();
        ctx.stroke();
    }

    return {
        init: function () {
            var can = document.getElementById("canvas");

            // Evento de clic en el canvas
            can.addEventListener("click", function (evt) {
                var rect = can.getBoundingClientRect();
                var x = evt.clientX - rect.left;
                var y = evt.clientY - rect.top;
                app.publishPoint(x, y);
            });

            // Evento del botón "Enviar Punto"
            document.getElementById("sendPointBtn").addEventListener("click", function () {
                var x = document.getElementById("x").value;
                var y = document.getElementById("y").value;
                app.publishPoint(parseInt(x), parseInt(y));
            });

            // Evento del botón "Conectarse"
            document.getElementById("connectBtn").addEventListener("click", function () {
                var drawingId = document.getElementById("drawingId").value;
                if (drawingId) {
                    connectAndSubscribe(drawingId);
                } else {
                    alert("Ingrese un ID de dibujo para conectarse.");
                }
            });
        },

        publishPoint: function (px, py) {
            var pt = { x: px, y: py };
            console.info("Publicando punto:", pt);

            let jsonData = JSON.stringify(pt);
            console.log("JSON a enviar:", jsonData);

            addPointToCanvas(pt);

            var drawingId = document.getElementById("drawingId").value;
            if (stompClient !== null && drawingId) {
                stompClient.send("/app/newpoint." + drawingId, {}, jsonData);
            } else {
                alert("No está conectado a un dibujo. Conéctese primero.");
            }
        },

        disconnect: function () {
            if (stompClient !== null) {
                stompClient.disconnect();
            }
            console.log("Desconectado");
        }
    };
})();

// Llamar `init()` cuando la página termine de cargar
window.onload = function () {
    app.init();
};
